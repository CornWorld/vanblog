import {
  createSignal,
  createMemo,
  createResource,
  createEffect,
  onMount,
  Show,
  For,
  Switch,
  Match,
} from "solid-js";
import { api, type RunSummary, type RunDetail, type SessionEvent } from "./api";

// ── helpers ──
const esc = (s: unknown) => String(s ?? "-");
const fmtTime = (iso?: string) =>
  iso ? iso.slice(0, 19).replace("T", " ") : "-";
const fmtSec = (s?: number | null) => (s != null ? s.toFixed(1) + "s" : "-");
const fmtNum = (n?: number | null) => (n != null ? n.toLocaleString() : "-");

const evalBadge = (st?: string | null) =>
  st === "passed"
    ? "badge-success"
    : st === "failed"
    ? "badge-error"
    : "badge-warning";

const pctOf = (r: RunSummary) => {
  const m = r.evalScore?.match(/(\d+)\/(\d+)/);
  return m ? Math.round((parseInt(m[1]) / parseInt(m[2])) * 100) : -1;
};

// ── session metrics (computed client-side from raw session events) ──
// NOTE on timestamps: an assistant message's timestamp is when the model request
// was SENT (right after the previous tool result); a toolResult's timestamp is when
// the tool finished. So gap(assistant → toolResult) = model generation + tool
// execution combined — the session does NOT record when the model response arrived,
// so "thinking" vs "tool" cannot be separated from timestamps alone.
// We therefore break time down by ROUND (each assistant message → its completion).
function computeSessionMetrics(events: SessionEvent[]) {
  let firstTs = Infinity,
    lastTs = -Infinity;
  let modelRequests = 0,
    toolCalls = 0,
    toolResultErrors = 0;
  const toolCallCounts: Record<string, number> = {};
  const tokens = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    reasoning: 0,
  };
  const rounds: {
    model: string;
    stopReason: string;
    input: number;
    output: number;
    elapsedMs: number;
    tools: string[];
  }[] = [];
  const assistantMsg: {
    ts: number;
    model: string;
    stopReason: string;
    input: number;
    output: number;
    tools: string[];
  }[] = [];
  let lastEventTs = -Infinity;

  for (const e of events) {
    if (e.type !== "message") continue;
    const m = e.message;
    const ts = m.timestamp;
    if (ts < firstTs) firstTs = ts;
    if (ts > lastTs) lastTs = ts;
    if (ts > lastEventTs) lastEventTs = ts;

    if (m.role === "assistant") {
      modelRequests++;
      tokens.input += m.usage?.input ?? 0;
      tokens.output += m.usage?.output ?? 0;
      tokens.cacheRead += m.usage?.cacheRead ?? 0;
      tokens.cacheWrite += m.usage?.cacheWrite ?? 0;
      tokens.reasoning += m.usage?.reasoning ?? 0;
      const tools: string[] = [];
      for (const part of m.content ?? []) {
        if (part.type === "toolCall") {
          toolCalls++;
          toolCallCounts[part.name] = (toolCallCounts[part.name] ?? 0) + 1;
          tools.push(part.name);
        }
      }
      assistantMsg.push({
        ts,
        model: m.model,
        stopReason: m.stopReason,
        input: m.usage?.input ?? 0,
        output: m.usage?.output ?? 0,
        tools,
      });
    } else if (m.role === "toolResult") {
      if (m.isError) toolResultErrors++;
    }
  }

  for (let i = 0; i < assistantMsg.length; i++) {
    const a = assistantMsg[i];
    const end =
      i + 1 < assistantMsg.length ? assistantMsg[i + 1].ts : lastEventTs;
    rounds.push({
      model: a.model,
      stopReason: a.stopReason,
      input: a.input,
      output: a.output,
      elapsedMs: Math.max(0, end - a.ts),
      tools: a.tools,
    });
  }

  const totalTokens =
    tokens.input +
    tokens.output +
    tokens.cacheRead +
    tokens.cacheWrite +
    tokens.reasoning;
  const wallMs = firstTs !== Infinity ? lastTs - firstTs : 0;

  return {
    timeline: { wallSeconds: Math.round(wallMs / 100) / 10 },
    agent: {
      modelRequestCount: modelRequests,
      toolCallCount: toolCalls,
      toolResultErrorCount: toolResultErrors,
      toolCallCounts,
    },
    tokens: { ...tokens, totalTokens },
    rounds,
  };
}

// ── insight: auto-generated findings from a run ──
function generateInsights(
  sm: ReturnType<typeof computeSessionMetrics> | null,
  score: RunDetail["score"],
  run: Record<string, any>
) {
  const ins: { level: "ok" | "warn" | "err"; text: string }[] = [];
  if (!sm) {
    ins.push({ level: "warn", text: "无 session 数据，无法分析执行过程" });
    return ins;
  }
  const wall = sm.timeline.wallSeconds;
  if (wall > 600)
    ins.push({
      level: "warn",
      text: `总耗时 ${fmtSec(wall)}，超过 10 分钟，可能接近超时`,
    });
  const tok = sm.tokens.totalTokens;
  if (tok > 500000)
    ins.push({ level: "warn", text: `token 消耗 ${fmtNum(tok)}，偏高` });
  const errs = sm.agent.toolResultErrorCount;
  if (errs > 0)
    ins.push({
      level: "warn",
      text: `${errs} 次工具执行报错，agent 可能走了弯路`,
    });
  const sorted = [...sm.rounds].sort((a, b) => b.elapsedMs - a.elapsedMs);
  const top = sorted[0];
  if (top && top.elapsedMs > 60000) {
    const pct = (top.elapsedMs / (wall * 1000)) * 100;
    ins.push({
      level: "ok",
      text: `单轮耗时 ${fmtSec(top.elapsedMs / 1000)} (占 ${pct.toFixed(
        0
      )}%)：输出 ${fmtNum(top.output)} tokens，是主要瓶颈`,
    });
  }
  const tools = Object.entries(sm.agent.toolCallCounts).sort(
    (a, b) => b[1] - a[1]
  );
  if (tools.length) {
    const [topTool, cnt] = tools[0];
    ins.push({ level: "ok", text: `最常用工具 ${topTool} (${cnt} 次)` });
  }
  if (score?.status === "passed")
    ins.push({
      level: "ok",
      text: `评测通过 ${score.score?.passed}/${score.score?.total}`,
    });
  else if (score?.status === "failed")
    ins.push({
      level: "err",
      text: `评测失败：${score.runtime?.failed?.join(", ") || "未知"}`,
    });
  return ins;
}

// ── evidence collapse (lazy load on open) ──
function Evidence(props: {
  title: string;
  getter: () => Promise<string> | string;
}) {
  const [text, setText] = createSignal<string | null>(null);
  const [loaded, setLoaded] = createSignal(false);
  const load = async () => {
    if (loaded()) return;
    setLoaded(true);
    try {
      setText(await props.getter());
    } catch (e) {
      setText("(load failed: " + e + ")");
    }
  };
  return (
    <details class="collapse collapse-arrow bg-base-300 mt-2" onclick={load}>
      <summary class="collapse-title text-sm">{props.title}</summary>
      <div class="collapse-content">
        <pre class="text-xs overflow-auto max-h-80 whitespace-pre-wrap">
          {esc(text() ?? "(loading…)")}
        </pre>
      </div>
    </details>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW 1: RUN LIST  —  "哪个实验值得看？"
// ══════════════════════════════════════════════════════════════
interface RunFilter {
  state: string;
  eval: string;
  model: string;
  sort: string;
}

function RunList(props: {
  rows: RunSummary[];
  models: string[];
  stats: {
    total: number;
    passed: number;
    failed: number;
    incomplete: number;
    pct: number | null;
  };
  filter: RunFilter;
  onFilter: (f: RunFilter) => void;
  onSelect: (id: string) => void;
}) {
  const { models, filter, onFilter, onSelect } = props;
  const rows = () => props.rows;
  const stats = () => props.stats;
  const f = () => filter;
  return (
    <div class="max-w-6xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-1">Agent Experiment Reports</h1>
      <p class="text-sm opacity-60 mb-4">pi agent 实验报告落地页 + 历史溯源</p>

      <div class="flex flex-wrap gap-2 mb-4">
        <span class="badge badge-outline badge-neutral">
          total: {stats().total}
        </span>
        <span class="badge badge-outline badge-success">
          passed: {stats().passed}
        </span>
        <span class="badge badge-outline badge-error">
          failed: {stats().failed}
        </span>
        <span class="badge badge-outline badge-warning">
          incomplete: {stats().incomplete}
        </span>
        {stats().pct != null && (
          <span class="badge badge-outline badge-info">
            pass rate: {stats().pct}%
          </span>
        )}
      </div>

      <div class="flex flex-wrap gap-2 mb-4 items-center">
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            onFilter({ ...f(), state: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="all">state: all</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
        </select>
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            onFilter({ ...f(), eval: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="all">eval: all</option>
          <option value="passed">passed</option>
          <option value="failed">failed</option>
          <option value="incomplete">incomplete</option>
        </select>
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            onFilter({ ...f(), model: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="all">model: all</option>
          <For each={models}>{(m) => <option value={m}>{esc(m)}</option>}</For>
        </select>
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            onFilter({ ...f(), sort: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="mtime-desc">sort: newest</option>
          <option value="mtime-asc">sort: oldest</option>
          <option value="score-desc">sort: score ↓</option>
          <option value="score-asc">sort: score ↑</option>
        </select>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>run</th>
              <th>exit</th>
              <th>eval</th>
              <th>score</th>
              <th>model</th>
              <th class="text-right">req</th>
              <th class="text-right">tokens</th>
              <th class="text-right">wall</th>
              <th>mtime</th>
            </tr>
          </thead>
          <tbody>
            <Show when={rows().length === 0}>
              <tr>
                <td colspan="9" class="text-center opacity-50 py-4">
                  no runs match filter
                </td>
              </tr>
            </Show>
            <For each={rows()}>
              {(r) => (
                <tr class="hover cursor-pointer" onclick={() => onSelect(r.id)}>
                  <td class="font-mono text-xs">{esc(r.id)}</td>
                  <td>
                    <span
                      class={
                        "badge badge-sm " +
                        (r.exitReason === "completed"
                          ? "badge-success"
                          : "badge-warning")
                      }
                    >
                      {esc(r.exitReason)}
                    </span>
                  </td>
                  <td>
                    <span class={"badge badge-sm " + evalBadge(r.evalStatus)}>
                      {esc(r.evalStatus)}
                    </span>
                  </td>
                  <td class="font-mono text-xs">{esc(r.evalScore ?? "-")}</td>
                  <td class="text-xs opacity-70">{esc(r.model)}</td>
                  <td class="text-right">{esc(r.requests)}</td>
                  <td class="text-right">{esc(r.tokens)}</td>
                  <td class="text-right">
                    {r.wallSeconds != null ? r.wallSeconds + "s" : "-"}
                  </td>
                  <td class="text-xs opacity-60">{fmtTime(r.mtime)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW 2: RUN DETAIL  (结论 + insight + 评测 + 证据)
// ══════════════════════════════════════════════════════════════
function RunDetail({
  detail,
  onBack,
  onOpenSession,
}: {
  detail: RunDetail;
  onBack: () => void;
  onOpenSession: (id: string) => void;
}) {
  const d = () => detail;
  const score = () => d().score ?? null;
  const run = () => (d().run ?? {}) as Record<string, any>;
  const isolation = () => (run().isolation ?? {}) as Record<string, any>;
  const [sessionEvents] = createResource(() => d().id, api.session);
  const sessionMetrics = createMemo(() => {
    const ev = sessionEvents();
    return ev && ev.length ? computeSessionMetrics(ev) : null;
  });
  const insights = createMemo(() =>
    generateInsights(sessionMetrics(), score(), run())
  );

  const list = (arr: string[] | undefined, cls: string) =>
    arr && arr.length ? (
      <ul class="text-sm mt-1 space-y-1">
        <For each={arr}>
          {(x) => (
            <li>
              <span class={"badge badge-sm mr-2 " + cls}>✓</span>
              {esc(x)}
            </li>
          )}
        </For>
      </ul>
    ) : (
      <p class="text-xs opacity-50">none</p>
    );

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="breadcrumbs text-sm mb-4">
        <ul>
          <li>
            <a class="link link-hover cursor-pointer" onclick={onBack}>
              runs
            </a>
          </li>
          <li class="font-mono">{esc(d().id)}</li>
        </ul>
      </div>

      <div class="card bg-base-200 mt-2">
        <div class="card-body">
          <div class="card-title flex flex-wrap gap-2">
            <span class="font-mono text-sm">{esc(d().id)}</span>
            <span class={"badge " + evalBadge(score()?.status)}>
              {esc(score()?.status ?? "no-eval")}
            </span>
            {score()?.score?.pct != null && (
              <span class="badge badge-neutral">{score()!.score!.pct}%</span>
            )}
            {d().closedNote && (
              <span class="badge badge-ghost">{esc(d().closedNote)}</span>
            )}
          </div>
          {score()?.summary && (
            <p class="text-sm mt-2">
              <span class="font-bold">结论: </span>
              {esc(score()!.summary)}
            </p>
          )}

          <div class="stats stats-shadow w-full my-3">
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtSec(sessionMetrics()?.timeline?.wallSeconds)}
              </div>
              <div class="stat-title text-xs">wall</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtNum(sessionMetrics()?.tokens?.totalTokens)}
              </div>
              <div class="stat-title text-xs">tokens</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sessionMetrics()?.agent?.modelRequestCount)}
              </div>
              <div class="stat-title text-xs">requests</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sessionMetrics()?.agent?.toolCallCount)}
              </div>
              <div class="stat-title text-xs">toolCalls</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sessionMetrics()?.agent?.toolResultErrorCount ?? 0)}
              </div>
              <div class="stat-title text-xs">errors</div>
            </div>
          </div>

          <Show when={insights().length > 0}>
            <h3 class="text-sm font-bold mb-1">洞察</h3>
            <ul class="text-sm space-y-1">
              <For each={insights()}>
                {(i) => (
                  <li>
                    <span
                      class={
                        "badge badge-sm mr-2 " +
                        (i.level === "ok"
                          ? "badge-success"
                          : i.level === "warn"
                          ? "badge-warning"
                          : "badge-error")
                      }
                    >
                      {i.level === "ok" ? "✓" : i.level === "warn" ? "!" : "✗"}
                    </span>
                    {esc(i.text)}
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <div class="flex gap-2 mt-3">
            <Show when={!!sessionMetrics()}>
              <button
                class="btn btn-sm btn-primary"
                onclick={() => onOpenSession(d().id)}
              >
                查看 Session 执行过程
              </button>
            </Show>
            <button class="btn btn-sm btn-ghost" onclick={onBack}>
              返回列表
            </button>
          </div>
        </div>
      </div>

      <div class="card bg-base-200 mt-4">
        <div class="card-body">
          <h3 class="text-sm font-bold mb-1">评测明细</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="bg-base-300 rounded-lg p-3">
              <h4 class="text-xs font-bold text-success">
                静态通过 ({score()?.static?.passed?.length ?? 0})
              </h4>
              {list(score()?.static?.passed, "badge-success")}
            </div>
            <div class="bg-base-300 rounded-lg p-3">
              <h4 class="text-xs font-bold text-error">
                静态失败 ({score()?.static?.failed?.length ?? 0})
              </h4>
              {list(score()?.static?.failed, "badge-error")}
            </div>
            <div class="bg-base-300 rounded-lg p-3">
              <h4 class="text-xs font-bold text-success">
                运行时通过 ({score()?.runtime?.passed?.length ?? 0})
              </h4>
              {list(score()?.runtime?.passed, "badge-success")}
            </div>
            <div class="bg-base-300 rounded-lg p-3">
              <h4 class="text-xs font-bold text-error">
                运行时失败 ({score()?.runtime?.failed?.length ?? 0})
              </h4>
              {list(score()?.runtime?.failed, "badge-error")}
              {score()?.runtime?.blocked?.length ? (
                <h4 class="text-xs font-bold text-warning mt-2">
                  阻塞 ({score()!.runtime!.blocked!.length})
                </h4>
              ) : null}
              {score()?.runtime?.blocked?.length
                ? list(score()!.runtime!.blocked, "badge-warning")
                : null}
            </div>
          </div>
          {score()?.score && (
            <p class="text-xs opacity-60 mt-2">
              score: {score()!.score!.passed}/{score()!.score!.total} (skipped{" "}
              {score()!.score!.skipped})
            </p>
          )}
        </div>
      </div>

      <details class="collapse collapse-arrow bg-base-300 mt-4">
        <summary class="collapse-title text-sm">配置 run.json</summary>
        <div class="collapse-content text-sm space-y-1">
          <p>model: {esc(run().agentModel)}</p>
          <p>image: {esc(run().image)}</p>
          <p>timeout: {esc(run().agentTimeout)}s</p>
          <p>isolation.probePassed: {esc(isolation().probePassed)}</p>
          <p>
            exitReason: {esc(run().piExitReason)}
            {run().piTimedOut ? " (timed out)" : ""}
          </p>
          <p>generatedAt: {fmtTime(run().generatedAt as string)}</p>
        </div>
      </details>

      <h3 class="text-sm font-bold mb-1 mt-4">证据链</h3>
      <Evidence title="transcript" getter={() => d().transcript || "(empty)"} />
      <Evidence
        title="container.log"
        getter={() => api.file(d().id, "container.log")}
      />
      <Evidence
        title="score.json"
        getter={() => JSON.stringify(score(), null, 2)}
      />
      <Evidence
        title="run.json"
        getter={() => JSON.stringify(run(), null, 2)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// VIEW 3: SESSION DETAIL  (时间花在哪？)
// ══════════════════════════════════════════════════════════════
function SessionDetail({
  runId,
  onBack,
}: {
  runId: string;
  onBack: () => void;
}) {
  const [sessionEvents] = createResource(() => runId, api.session);
  const sm = createMemo(() => {
    const ev = sessionEvents();
    return ev && ev.length ? computeSessionMetrics(ev) : null;
  });
  const sorted = createMemo(() =>
    (sm()?.rounds ?? []).slice().sort((a, b) => b.elapsedMs - a.elapsedMs)
  );

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="breadcrumbs text-sm mb-4">
        <ul>
          <li>
            <a class="cursor link-hover" onclick={onBack}>
              runs
            </a>
          </li>
          <li class="font-mono">{esc(runId)}</li>
          <li>session</li>
        </ul>
      </div>

      <h1 class="text-xl font-bold mb-2">Session 执行过程</h1>

      {sm() ? (
        <>
          <div class="stats stats-shadow w-full my-3">
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtSec(sm()?.timeline?.wallSeconds)}
              </div>
              <div class="stat-title text-xs">wall</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtNum(sm()?.tokens?.totalTokens)}
              </div>
              <div class="stat-title text-xs">tokens</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sm()?.agent?.modelRequestCount)}
              </div>
              <div class="stat-title text-xs">requests</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sm()?.agent?.toolCallCount)}
              </div>
              <div class="stat-title text-xs">toolCalls</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sm()?.agent?.toolResultErrorCount ?? 0)}
              </div>
              <div class="stat-title text-xs">errors</div>
            </div>
          </div>

          <h3 class="text-sm font-bold mb-1 mt-2">工具调用分布</h3>
          <div class="flex flex-wrap gap-2 mb-4">
            <For
              each={Object.entries(sm()?.agent?.toolCallCounts ?? {}).sort(
                (a, b) => b[1] - a[1]
              )}
            >
              {([name, cnt]) => (
                <span class="badge badge-outline badge-neutral">
                  {esc(name)}: {cnt}
                </span>
              )}
            </For>
          </div>

          <h3 class="text-sm font-bold mb-1 mt-2">
            轮次耗时 <span class="text-xs opacity-50">(按耗时降序)</span>
          </h3>
          <div class="overflow-x-auto mb-4">
            <table class="table table-xs table-zebra">
              <thead>
                <tr>
                  <th>#</th>
                  <th class="text-right">elapsed</th>
                  <th class="text-right">in</th>
                  <th class="text-right">out</th>
                  <th>tools</th>
                  <th>stop</th>
                </tr>
              </thead>
              <tbody>
                <For each={sorted()}>
                  {(r, i) => (
                    <tr>
                      <td class="text-xs opacity-60">{i() + 1}</td>
                      <td class="text-right font-mono">
                        <b>{fmtSec(r.elapsedMs / 1000)}</b>
                      </td>
                      <td class="text-right">{fmtNum(r.input)}</td>
                      <td class="text-right">{fmtNum(r.output)}</td>
                      <td class="font-mono text-xs">
                        {r.tools.join(", ") || "-"}
                      </td>
                      <td class="text-xs opacity-70">{r.stopReason}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p class="text-sm opacity-60 my-3">no session data</p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP — 多级页面路由
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = createSignal<
    | { name: "list" }
    | { name: "detail"; id: string }
    | { name: "session"; id: string }
  >({ name: "list" });
  const [filter, setFilter] = createSignal<RunFilter>({
    state: "all",
    eval: "all",
    model: "all",
    sort: "mtime-desc",
  });

  // current run id — stable for TS narrowing (view() is a union)
  const currentId = createMemo(() => {
    const v = view();
    return v.name === "list" ? null : v.id;
  });

  const [runs] = createResource(api.runs);
  const [detail, setDetail] = createSignal<RunDetail | null>(null);
  createEffect(() => {
    const id = currentId();
    if (id && view().name === "detail") api.run(id).then(setDetail);
  });
  const [sessionEvents, setSessionEvents] = createSignal<SessionEvent[] | null>(
    null
  );
  createEffect(() => {
    const id = currentId();
    if (id && view().name === "session") api.session(id).then(setSessionEvents);
  });

  const models = createMemo(() => {
    const r = runs();
    return r
      ? [...new Set(r.map((x) => x.model).filter(Boolean) as string[])].sort()
      : [];
  });

  const rows = createMemo(() => {
    const r = runs();
    if (!r) return [];
    const f = filter();
    const out = r.filter(
      (x) =>
        (f.state === "all" || x.state === f.state) &&
        (f.eval === "all" || x.evalStatus === f.eval) &&
        (f.model === "all" || x.model === f.model)
    );
    return [...out].sort((a, b) => {
      switch (f.sort) {
        case "mtime-asc":
          return a.mtime.localeCompare(b.mtime);
        case "score-desc":
          return pctOf(b) - pctOf(a);
        case "score-asc":
          return pctOf(a) - pctOf(b);
        default:
          return b.mtime.localeCompare(a.mtime);
      }
    });
  });

  const stats = createMemo(() => {
    const r = runs() ?? [];
    const passed = r.filter((x) => x.evalStatus === "passed").length;
    const failed = r.filter((x) => x.evalStatus === "failed").length;
    const incomplete = r.filter((x) => x.evalStatus === "incomplete").length;
    const scored = passed + failed;
    return {
      total: r.length,
      passed,
      failed,
      incomplete,
      pct: scored ? Math.round((passed / scored) * 100) : null,
    };
  });

  const v = () => view();

  return (
    <Switch>
      <Match when={v().name === "list"}>
        <RunList
          rows={rows()}
          models={models()}
          stats={stats()}
          filter={filter()}
          onFilter={setFilter}
          onSelect={(id) => setView({ name: "detail", id })}
        />
      </Match>
      <Match when={v().name === "detail" && detail()}>
        {(d) => (
          <RunDetail
            detail={d()}
            onBack={() => setView({ name: "list" })}
            onOpenSession={(id) => setView({ name: "session", id })}
          />
        )}
      </Match>
      <Match when={v().name === "session" && currentId()}>
        <SessionDetail
          runId={currentId()!}
          onBack={() => setView({ name: "detail", id: currentId()! })}
        />
      </Match>
    </Switch>
  );
}
