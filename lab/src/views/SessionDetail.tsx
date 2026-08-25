import {
  createResource,
  createMemo,
  For,
  Show,
  type Component,
} from "solid-js";
import { A } from "@solidjs/router";
import { api } from "../api";
import { esc, fmtSec, fmtNum, fmtCost, highlightJson } from "../lib/format";
import {
  computeSessionMetrics,
  METRIC_DEFINITIONS,
  buildSessionTrace,
  type SessionTrace,
  type TraceStep,
  type TraceTimelineItem,
  type ConfigEvent,
} from "../lib/metrics";

// ── timeline item rendering ──

function TimelineUserMessage({ text }: { text: string }) {
  const MAX = 200;
  const display = text.length > MAX ? text.slice(0, MAX) + "…" : text;
  const isLong = text.length > MAX;
  return (
    <div class="card card-compact bg-base-300 my-1">
      <div class="card-body p-3">
        <div class="flex items-start gap-2">
          <span class="text-sm">👤</span>
          <div class="flex-1 min-w-0">
            {isLong ? (
              <details>
                <summary class="cursor-pointer text-xs opacity-70">
                  {esc(display)}
                  <span class="ml-1 link link-hover">展开全部</span>
                </summary>
                <pre class="text-xs whitespace-pre-wrap mt-1 max-h-60 overflow-auto">
                  {esc(text)}
                </pre>
              </details>
            ) : (
              <pre class="text-xs whitespace-pre-wrap">{esc(display)}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineConfigEvent({ ev }: { ev: ConfigEvent }) {
  const label = () => {
    switch (ev.type) {
      case "model_change":
        return `⚙ model → ${esc(ev.modelChange?.provider ?? "-")}/${esc(
          ev.modelChange?.modelId ?? "-"
        )}`;
      case "thinking_level_change":
        return `⚙ thinking → ${esc(ev.thinkingLevel ?? "-")}`;
      case "compaction":
        return `📦 compaction: ${ev.compaction?.tokensBefore ?? "-"} → ${
          ev.compaction?.retainedTailLength ?? "-"
        } msgs`;
      case "branch_summary":
        return `🌿 branch summary from ${esc(ev.branchSummary?.fromId ?? "-")}`;
      case "active_tools_change":
        return `⚙ tools: ${esc((ev.activeTools ?? []).join(", "))}`;
      case "custom":
        return `• ${esc(ev.customType ?? "")}`;
      default:
        return "⚙";
    }
  };
  return (
    <div class="text-xs opacity-60 py-0.5 pl-2 border-l-2 border-base-300">
      {label()}
    </div>
  );
}

function ToolCallBlock({ block }: { block: TraceStep["toolCallBlocks"][0] }) {
  return (
    <details class="collapse collapse-arrow bg-base-200 my-0.5">
      <summary class="collapse-title text-xs py-1.5 min-h-0">
        <span class="badge badge-sm badge-outline badge-neutral mr-1">
          {esc(block.toolName ?? "-")}
        </span>
        <span class="opacity-50">args</span>
      </summary>
      <div class="collapse-content">
        <pre
          class="text-xs max-h-60 overflow-auto whitespace-pre-wrap"
          innerHTML={highlightJson(
            JSON.stringify(block.arguments ?? null, null, 2)
          )}
        />
      </div>
    </details>
  );
}

function ToolResultBlock({ result }: { result: TraceStep["toolResults"][0] }) {
  const contentText = () =>
    (result.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n") || "(no text content)";
  return (
    <details class="collapse collapse-arrow bg-base-200 my-0.5">
      <summary class="collapse-title text-xs py-1.5 min-h-0">
        <span class="badge badge-sm badge-outline badge-neutral mr-1">
          {esc(result.toolName)}
        </span>
        {result.isError ? (
          <span class="badge badge-sm badge-error gap-1">error</span>
        ) : (
          <span class="badge badge-sm badge-success gap-1">ok</span>
        )}
      </summary>
      <div class="collapse-content">
        <pre class="text-xs max-h-40 overflow-auto whitespace-pre-wrap">
          {esc(contentText())}
        </pre>
      </div>
    </details>
  );
}

const TimelineStep: Component<{ step: TraceStep; index: number }> = (props) => {
  const s = props.step;
  const toolNames = s.toolCallBlocks.map((b) => b.toolName ?? "?");
  const summary = `🤖 #${props.index} · ${esc(s.model)} · ${fmtSec(
    s.elapsedMs / 1000
  )} · ${fmtNum(s.usage.totalTokens)} tok · ${
    s.toolCallBlocks.length
  } tools (${esc(toolNames.join(", "))})`;

  return (
    <details class="collapse collapse-arrow bg-base-200 my-1">
      <summary class="collapse-title text-sm py-2 min-h-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span>{summary}</span>
          <Show when={s.stopReason === "error"}>
            <span class="badge badge-sm badge-error gap-1">error</span>
          </Show>
        </div>
      </summary>
      <div class="collapse-content space-y-2">
        {/* 🧠 Thinking */}
        <Show when={s.thinkingBlocks.length > 0}>
          <details class="collapse collapse-arrow bg-base-300">
            <summary class="collapse-title text-xs py-1.5 min-h-0">
              🧠 Thinking ({s.thinkingBlocks.length})
            </summary>
            <div class="collapse-content space-y-1">
              <For each={s.thinkingBlocks}>
                {(tb) => (
                  <pre class="text-xs whitespace-pre-wrap max-h-60 overflow-auto bg-base-100 p-2 rounded">
                    {esc(tb.thinking ?? "")}
                  </pre>
                )}
              </For>
            </div>
          </details>
        </Show>

        {/* 💬 Response */}
        <Show when={s.textBlocks.length > 0}>
          <div>
            <div class="text-xs font-bold opacity-70 mb-1">💬 Response</div>
            <pre class="text-xs whitespace-pre-wrap bg-base-100 p-2 rounded">
              {esc(s.textBlocks.map((b) => b.text ?? "").join(""))}
            </pre>
          </div>
        </Show>

        {/* 🔧 Tool Calls */}
        <Show when={s.toolCallBlocks.length > 0}>
          <div>
            <div class="text-xs font-bold opacity-70 mb-1">
              🔧 Tool Calls ({s.toolCallBlocks.length})
            </div>
            <For each={s.toolCallBlocks}>
              {(block) => <ToolCallBlock block={block} />}
            </For>
          </div>
        </Show>

        {/* 📤 Tool Results */}
        <Show when={s.toolResults.length > 0}>
          <div>
            <div class="text-xs font-bold opacity-70 mb-1">
              📤 Tool Results ({s.toolResults.length})
            </div>
            <For each={s.toolResults}>
              {(result) => <ToolResultBlock result={result} />}
            </For>
          </div>
        </Show>
      </div>
    </details>
  );
};

const TimelineItem: Component<{
  item: TraceTimelineItem;
  stepIndex: number;
}> = (props) => {
  const item = props.item;
  switch (item.kind) {
    case "user":
      return <TimelineUserMessage text={item.item.text} />;
    case "config":
      return <TimelineConfigEvent ev={item.item} />;
    case "step":
      return <TimelineStep step={item.item} index={props.stepIndex} />;
  }
};

export function SessionDetail({ id }: { id: string }) {
  const [sessionEvents, { refetch: refetchSession }] = createResource(
    () => id,
    api.session
  );
  const sm = createMemo(() => {
    const ev = sessionEvents();
    return ev && ev.length ? computeSessionMetrics(ev) : null;
  });
  const trace = createMemo((): SessionTrace | null => {
    const ev = sessionEvents();
    return ev && ev.length ? buildSessionTrace(ev) : null;
  });
  const sorted = createMemo(() =>
    (sm()?.rounds ?? []).slice().sort((a, b) => b.elapsedMs - a.elapsedMs)
  );

  // Build step-index lookup: for each timeline item of kind "step",
  // determine its 1-based index among all steps in the trace
  const stepIndexMap = createMemo(() => {
    const tr = trace();
    if (!tr) return new Map<string, number>();
    const map = new Map<string, number>();
    let idx = 0;
    for (const item of tr.timeline) {
      if (item.kind === "step") {
        idx++;
        map.set(item.item.entryId, idx);
      }
    }
    return map;
  });

  return (
    <div class="max-w-6xl mx-auto p-6">
      <div class="breadcrumbs text-sm mb-4">
        <ul>
          <li>
            <A href="/" class="link link-hover">
              runs
            </A>
          </li>
          <li>
            <A href={`/runs/${esc(id)}`} class="link link-hover font-mono">
              {esc(id)}
            </A>
          </li>
          <li>session</li>
        </ul>
      </div>

      <h1 class="text-xl font-bold mb-2">Session 执行过程</h1>

      {sessionEvents.loading ? (
        <p class="text-sm opacity-60 my-3">加载 session…</p>
      ) : sessionEvents.error ? (
        <div class="alert alert-error my-3">
          <span>加载失败：{String(sessionEvents.error)}</span>
          <button class="btn btn-sm" onclick={() => void refetchSession()}>
            重试
          </button>
        </div>
      ) : sm() ? (
        <>
          {sm()!.timeline.timestampAdjusted && (
            <div class="alert alert-warning my-3">
              <span>
                部分 session 时间戳缺失或乱序，已按可用时间排序；耗时仅供参考。
              </span>
            </div>
          )}
          <div class="stats stats-shadow w-full my-3">
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtSec(sm()?.timeline?.wallSeconds)}
              </div>
              <div class="stat-title text-xs">wall (session observed)</div>
              <div class="text-xs opacity-50">{METRIC_DEFINITIONS.wall}</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtNum(sm()?.tokens?.totalTokens)}
              </div>
              <div class="stat-title text-xs">tokens</div>
              <div class="text-xs opacity-50">{METRIC_DEFINITIONS.tokens}</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sm()?.agent?.modelRequestCount)}
              </div>
              <div class="stat-title text-xs">requests</div>
              <div class="text-xs opacity-50">
                {METRIC_DEFINITIONS.requests}
              </div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sm()?.agent?.toolCallCount)}
              </div>
              <div class="stat-title text-xs">toolCalls</div>
              <div class="text-xs opacity-50">
                {METRIC_DEFINITIONS.toolCalls}
              </div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {esc(sm()?.agent?.toolResultErrorCount ?? 0)}
              </div>
              <div class="stat-title text-xs">errors</div>
              <div class="text-xs opacity-50">{METRIC_DEFINITIONS.errors}</div>
            </div>
            <div class="stat">
              <div class="stat-value text-xl">
                {fmtCost(trace()?.totalCost)}
              </div>
              <div class="stat-title text-xs">cost</div>
              <div class="text-xs opacity-50">total cost across all steps</div>
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

          {/* 执行时间线 */}
          <h3 class="text-sm font-bold mb-1 mt-2">
            执行时间线{" "}
            <span class="text-xs opacity-50">
              ({trace()?.timeline.length ?? 0} events)
            </span>
          </h3>
          <div class="space-y-1 mb-4">
            <For each={trace()?.timeline ?? []}>
              {(item) => (
                <TimelineItem
                  item={item}
                  stepIndex={
                    item.kind === "step"
                      ? stepIndexMap().get(item.item.entryId) ?? 0
                      : 0
                  }
                />
              )}
            </For>
          </div>

          <h3 class="text-sm font-bold mb-1 mt-2">
            耗时排名 <span class="text-xs opacity-50">(按轮次耗时降序)</span>
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
                        {esc(r.tools.join(", ")) || "-"}
                      </td>
                      <td class="text-xs opacity-70">{esc(r.stopReason)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p class="text-sm opacity-60 my-3">该 run 没有可用的 session 事件。</p>
      )}
    </div>
  );
}
