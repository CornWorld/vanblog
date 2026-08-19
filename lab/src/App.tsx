import { createSignal, createMemo, createResource, Show, For } from "solid-js";
import { api, type RunSummary, type RunDetail } from "./api";

// ── helpers ──
const esc = (s: unknown) => String(s ?? "-");
const fmtTime = (iso?: string) =>
  iso ? iso.slice(0, 19).replace("T", " ") : "-";

const evalBadge = (st?: string | null) =>
  st === "passed"
    ? "badge-success"
    : st === "failed"
    ? "badge-error"
    : "badge-warning";

const pctOf = (r: RunSummary) =>
  r.evalScore ? parseInt(r.evalScore.split("/")[0], 10) : -1;

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

// ── detail (report landing page, conclusion first) ──
function Detail(props: { detail: RunDetail; onClose: () => void }) {
  const d = () => props.detail;
  const score = () => d().score ?? null;
  const metrics = () => d().metrics ?? null;
  const run = () => (d().run ?? {}) as Record<string, any>;
  const isolation = () => (run().isolation ?? {}) as Record<string, any>;

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
    <div class="card bg-base-200 mt-6">
      <div class="card-body">
        {/* conclusion */}
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

        {/* config */}
        <details class="collapse collapse-arrow bg-base-300 mt-3">
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

        {/* eval summary */}
        <div class="mt-4">
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

        {/* metrics */}
        {metrics() ? (
          <div class="stats stats-shadow w-full my-4">
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(metrics()?.agent?.modelRequestCount)}
              </div>
              <div class="stat-title text-xs">requests</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(metrics()?.agent?.toolCallCount)}
              </div>
              <div class="stat-title text-xs">toolCalls</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(metrics()?.agent?.toolResultErrorCount)}
              </div>
              <div class="stat-title text-xs">errors</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(metrics()?.tokens?.totalTokens)}
              </div>
              <div class="stat-title text-xs">tokens</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(metrics()?.tokens?.cacheRead)}
              </div>
              <div class="stat-title text-xs">cacheRead</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {metrics()?.timeline?.wallSeconds != null
                  ? metrics()!.timeline!.wallSeconds + "s"
                  : "-"}
              </div>
              <div class="stat-title text-xs">wall</div>
            </div>
          </div>
        ) : (
          <p class="text-sm opacity-60 my-3">no session metrics</p>
        )}

        {/* evidence chain */}
        <h3 class="text-sm font-bold mb-1 mt-2">证据链</h3>
        <Evidence
          title="transcript"
          getter={() => d().transcript || "(empty)"}
        />
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

        <button
          class="btn btn-sm btn-ghost mt-3"
          onclick={() => props.onClose()}
        >
          close
        </button>
      </div>
    </div>
  );
}

// ── main app ──
export default function App() {
  const [filter, setFilter] = createSignal({
    state: "all",
    eval: "all",
    model: "all",
    sort: "mtime-desc",
  });
  const [selectedId, setSelectedId] = createSignal<string | null>(null);

  const [runs] = createResource(api.runs);
  const [detail] = createResource(selectedId, (id) =>
    id ? api.run(id) : null
  );

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

  const s = () => stats();
  const f = () => filter();

  return (
    <div class="max-w-6xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-1">Agent Experiment Reports</h1>
      <p class="text-sm opacity-60 mb-4">agent 实验 report 落地页 + 历史溯源</p>

      {/* summary stats */}
      <div class="flex flex-wrap gap-2 mb-4">
        <span class="badge badge-outline badge-neutral">
          total: {s().total}
        </span>
        <span class="badge badge-outline badge-success">
          passed: {s().passed}
        </span>
        <span class="badge badge-outline badge-error">
          failed: {s().failed}
        </span>
        <span class="badge badge-outline badge-warning">
          incomplete: {s().incomplete}
        </span>
        {s().pct != null && (
          <span class="badge badge-outline badge-info">
            pass rate: {s().pct}%
          </span>
        )}
      </div>

      {/* filters + sort */}
      <div class="flex flex-wrap gap-2 mb-4 items-center">
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            setFilter({ ...f(), state: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="all">state: all</option>
          <option value="open">open</option>
          <option value="closed">closed</option>
        </select>
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            setFilter({ ...f(), eval: (e.target as HTMLSelectElement).value })
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
            setFilter({ ...f(), model: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="all">model: all</option>
          <For each={models()}>
            {(m) => <option value={m}>{esc(m)}</option>}
          </For>
        </select>
        <select
          class="select select-sm select-bordered"
          onchange={(e) =>
            setFilter({ ...f(), sort: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="mtime-desc">sort: newest</option>
          <option value="mtime-asc">sort: oldest</option>
          <option value="score-desc">sort: score ↓</option>
          <option value="score-asc">sort: score ↑</option>
        </select>
      </div>

      {/* table */}
      <div class="overflow-x-auto">
        <table class="table table-zebra table-sm">
          <thead>
            <tr>
              <th>run</th>
              <th>state</th>
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
                <td colspan="10" class="text-center opacity-50 py-4">
                  no runs match filter
                </td>
              </tr>
            </Show>
            <For each={rows()}>
              {(r) => (
                <tr
                  class="hover cursor-pointer"
                  onclick={() => setSelectedId(r.id)}
                >
                  <td class="font-mono text-xs">{esc(r.id)}</td>
                  <td>
                    <span
                      class={
                        "badge badge-sm " +
                        (r.state === "closed" ? "badge-ghost" : "badge-info")
                      }
                    >
                      {esc(r.state)}
                    </span>
                  </td>
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

      {/* detail */}
      <Show when={detail()} fallback={null}>
        {(d) => <Detail detail={d()} onClose={() => setSelectedId(null)} />}
      </Show>
    </div>
  );
}
