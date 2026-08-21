import { createResource, createMemo, For } from "solid-js";
import { api } from "../api";
import { esc, fmtSec, fmtNum } from "../lib/format";
import { computeSessionMetrics } from "../lib/metrics";

export function SessionDetail({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const [sessionEvents] = createResource(() => id, api.session);
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
          <li class="font-mono">{esc(id)}</li>
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