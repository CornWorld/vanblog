import { createResource, createMemo, Show, For } from "solid-js";
import { api, type RunDetail as RunDetailT } from "../api";
import { esc, fmtTime, fmtSec, fmtNum, evalBadge } from "../lib/format";
import { computeSessionMetrics, generateInsights } from "../lib/metrics";
import { Evidence } from "./Evidence";

export function RunDetail({
  id,
  onBack,
  onOpenSession,
}: {
  id: string;
  onBack: () => void;
  onOpenSession: (id: string) => void;
}) {
  const [detail] = createResource(() => id, api.run);
  const d = () => detail() ?? ({} as RunDetailT);
  const score = () => d().score ?? null;
  const run = () => (d().run ?? {}) as Record<string, any>;
  const isolation = () => (run().isolation ?? {}) as Record<string, any>;
  const [sessionEvents] = createResource(() => id, api.session);
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