import { createResource, createMemo, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { api, type RunDetail as RunDetailT } from "../api";
import {
  esc,
  fmtTime,
  fmtSec,
  fmtNum,
  evalBadge,
  highlightJson,
} from "../lib/format";
import {
  computeSessionMetrics,
  generateInsights,
  METRIC_DEFINITIONS,
} from "../lib/metrics";
import { EVAL_STRUCTURE, getCheckDesc } from "../lib/testcase-info";
import { Evidence } from "./Evidence";

export function RunDetail({ id }: { id: string }) {
  const [detail, { refetch: refetchDetail }] = createResource(
    () => id,
    api.run
  );
  const d = () => detail() ?? ({} as RunDetailT);
  const score = () => d().score ?? null;
  const run = () => d().run ?? {};
  const [sessionEvents] = createResource(() => id, api.session);
  const sessionMetrics = createMemo(() => {
    const ev = sessionEvents();
    return ev && ev.length ? computeSessionMetrics(ev) : null;
  });
  const scoreCheck = createMemo(() => {
    const s = score()?.score;
    if (
      !s ||
      ![s.total, s.passed, s.failed, s.skipped].every(Number.isInteger) ||
      s.total < 0 ||
      s.passed < 0 ||
      s.failed < 0 ||
      s.skipped < 0 ||
      s.passed + s.failed + s.skipped !== s.total
    )
      return null;
    return {
      ...s,
      derivedPct: s.total ? Math.round((s.passed / s.total) * 100) : 0,
    };
  });
  const insights = createMemo(() =>
    generateInsights(sessionMetrics(), score())
  );

  const list = (arr: string[] | undefined, cls: string) =>
    arr && arr.length ? (
      <ul class="text-sm mt-1 space-y-1">
        <For each={arr}>
          {(x) => (
            <li>
              <span class={"badge badge-sm mr-2 " + cls}>✓</span>
              {esc(x)}
              {getCheckDesc(x) && (
                <span class="text-xs opacity-50 ml-2">{getCheckDesc(x)}</span>
              )}
            </li>
          )}
        </For>
      </ul>
    ) : (
      <p class="text-xs opacity-50">none</p>
    );

  return (
    <div class="max-w-6xl mx-auto p-6">
      <Show when={detail.loading}>
        <p class="text-sm opacity-60 my-4">加载 run…</p>
      </Show>
      <Show when={detail.error}>
        <div class="alert alert-error my-4">
          <span>加载失败：{String(detail.error)}</span>
          <button class="btn btn-sm" onclick={() => void refetchDetail()}>
            重试
          </button>
        </div>
      </Show>
      <Show when={!detail.loading && !detail.error && !detail()}>
        <p class="text-sm opacity-60 my-4">暂无 run 数据</p>
      </Show>
      <Show when={!detail.loading && !detail.error && detail()}>
        <div class="breadcrumbs text-sm mb-4">
          <ul>
            <li>
              <A href="/" class="link link-hover">
                runs
              </A>
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
              {score() && (
                <span class="badge badge-neutral">
                  {scoreCheck()
                    ? `${scoreCheck()!.derivedPct}%`
                    : "score 数据异常/未验证"}
                </span>
              )}
              {d().closedNote && (
                <span class="badge badge-ghost">{esc(d().closedNote)}</span>
              )}
            </div>
            <Show when={score()?.status === "incomplete"}>
              <div class="alert alert-warning my-2">
                <span class="text-sm">
                  评测不完整 — agent {run().piTimedOut ? "超时" : "异常退出"}
                  {run().piExitReason ? ` (${run().piExitReason})` : ""}，pack
                  未产出，仅执行了 {score()?.score?.total ?? 0} 项静态检查
                </span>
              </div>
            </Show>
            {score()?.summary && (
              <p class="text-sm mt-2">
                <span class="font-bold">结论: </span>
                {esc(score()!.summary)}
              </p>
            )}

            <p class="text-xs opacity-50 mb-1">
              指标由前端从 session JSONL 实时计算，可能与列表页预计算值略有差异
            </p>
            <div class="stats stats-shadow w-full my-3">
              <div class="stat">
                <div class="stat-value text-xl">
                  {fmtSec(sessionMetrics()?.timeline?.wallSeconds)}
                </div>
                <div class="stat-title text-xs">wall (session observed)</div>
                <div class="text-xs opacity-50">{METRIC_DEFINITIONS.wall}</div>
              </div>
              <div class="stat">
                <div class="stat-value text-xl">
                  {fmtNum(sessionMetrics()?.tokens?.totalTokens)}
                </div>
                <div class="stat-title text-xs">tokens</div>
                <div class="text-xs opacity-50">
                  {METRIC_DEFINITIONS.tokens}
                </div>
              </div>
              <div class="stat">
                <div class="stat-value text-xl">
                  {esc(sessionMetrics()?.agent?.modelRequestCount)}
                </div>
                <div class="stat-title text-xs">requests</div>
                <div class="text-xs opacity-50">
                  {METRIC_DEFINITIONS.requests}
                </div>
              </div>
              <div class="stat">
                <div class="stat-value text-xl">
                  {esc(sessionMetrics()?.agent?.toolCallCount)}
                </div>
                <div class="stat-title text-xs">toolCalls</div>
                <div class="text-xs opacity-50">
                  {METRIC_DEFINITIONS.toolCalls}
                </div>
              </div>
              <div class="stat">
                <div class="stat-value text-xl">
                  {esc(sessionMetrics()?.agent?.toolResultErrorCount ?? 0)}
                </div>
                <div class="stat-title text-xs">errors</div>
                <div class="text-xs opacity-50">
                  {METRIC_DEFINITIONS.errors}
                </div>
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
                        {i.level === "ok"
                          ? "✓"
                          : i.level === "warn"
                          ? "!"
                          : "✗"}
                      </span>
                      {esc(i.text)}
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <div class="flex gap-2 mt-3">
              <Show when={!!sessionMetrics()}>
                <A
                  href={`/runs/${d().id}/session`}
                  class="btn btn-sm btn-primary"
                >
                  查看 Session 执行过程
                </A>
              </Show>
              <Show when={d().langfuse?.enabled}>
                <a
                  class="btn btn-sm btn-outline"
                  href={`${d().langfuse!.host}/sessions`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📊 View in Langfuse
                </a>
              </Show>
              <A href="/" class="btn btn-sm btn-ghost">
                返回列表
              </A>
            </div>
          </div>
        </div>

        <div class="card bg-base-200 mt-4">
          <div class="card-body">
            <h3 class="text-sm font-bold mb-1">评测明细</h3>
            <p class="text-xs opacity-60 mb-2">
              {score()?.status === "incomplete"
                ? `仅 ${
                    score()?.score?.total ?? 0
                  } 项静态检查（pack 未产出，运行时检查未执行）`
                : `${EVAL_STRUCTURE.static.total} ${EVAL_STRUCTURE.static.label} + ${EVAL_STRUCTURE.runtime.total} ${EVAL_STRUCTURE.runtime.label} = ${EVAL_STRUCTURE.fullTotal} 项总检查`}
            </p>
            <Show
              when={scoreCheck()}
              fallback={
                <p class="text-sm opacity-60">
                  {score()
                    ? "评测数据异常，明细未验证，不应视为可信结果"
                    : "未生成评测结果"}
                </p>
              }
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div class="bg-base-300 rounded-lg p-3">
                  <h4 class="text-xs font-bold text-success">
                    静态通过 · 文件结构与内容验证 (
                    {score()?.static?.passed?.length ?? 0})
                  </h4>
                  {list(score()?.static?.passed, "badge-success")}
                </div>
                <div class="bg-base-300 rounded-lg p-3">
                  <h4 class="text-xs font-bold text-error">
                    静态失败 · 文件结构与内容验证 (
                    {score()?.static?.failed?.length ?? 0})
                  </h4>
                  {list(score()?.static?.failed, "badge-error")}
                </div>
                <div class="bg-base-300 rounded-lg p-3">
                  <h4 class="text-xs font-bold text-success">
                    运行时通过 · Docker HTTP 调用验证 (
                    {score()?.runtime?.passed?.length ?? 0})
                  </h4>
                  {list(score()?.runtime?.passed, "badge-success")}
                </div>
                <div class="bg-base-300 rounded-lg p-3">
                  <h4 class="text-xs font-bold text-error">
                    运行时失败 · Docker HTTP 调用验证 (
                    {score()?.runtime?.failed?.length ?? 0})
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
            </Show>
            {score()?.score && (
              <p class="text-xs opacity-60 mt-2">
                {scoreCheck()
                  ? `score: ${scoreCheck()!.passed}/${
                      scoreCheck()!.total
                    } (skipped ${scoreCheck()!.skipped})`
                  : "score 数据异常/未验证"}
              </p>
            )}
          </div>
        </div>

        <h3 class="text-sm font-bold mb-1 mt-4">证据链</h3>
        <Show
          when={d().transcript}
          fallback={<p class="text-sm opacity-60">transcript unavailable</p>}
        >
          <Evidence
            title="transcript"
            description="Agent 原始输出流 — 模型对话记录"
            getter={() => d().transcript!}
          />
        </Show>
        <Show
          when={
            (d() as RunDetailT & { transcriptTruncated?: boolean })
              .transcriptTruncated
          }
        >
          <p class="text-xs text-warning">
            当前 transcript 内容可能已截断（仅显示前 20,000 字符）
          </p>
        </Show>
        <Evidence
          title="container.log"
          description="Docker 容器日志 — vanblog 启动 + pack hook 加载"
          getter={() => api.file(d().id, "container.log")}
        />
        <Evidence
          title="score.json"
          description="评测结果 — 静态 + 运行时检查明细"
          lang="json"
          getter={() => JSON.stringify(score(), null, 2)}
        />
        <Evidence
          title="run.json"
          description="运行元数据 — 模型/容器/超时/隔离配置"
          lang="json"
          getter={() => JSON.stringify(run(), null, 2)}
        />
      </Show>
    </div>
  );
}
