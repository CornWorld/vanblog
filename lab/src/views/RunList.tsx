import { Show, For } from "solid-js";
import type { RunSummary } from "../api";
import { esc, fmtTime, evalBadge } from "../lib/format";

export interface RunFilter {
  state: string;
  eval: string;
  model: string;
  sort: string;
}

export function RunList(props: {
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
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const { onFilter, onSelect } = props;
  const models = () => props.models;
  const rows = () => props.rows;
  const stats = () => props.stats;
  const f = () => props.filter;
  return (
    <div class="max-w-6xl mx-auto p-6">
      <h1 class="text-2xl font-bold mb-1">Agent Experiment Reports</h1>
      <p class="text-sm opacity-60 mb-4">pi agent 实验报告与历史运行记录</p>

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
            evaluated pass rate: {stats().pct}%
          </span>
        )}
      </div>

      <div class="flex flex-wrap gap-2 mb-4 items-center">
        <select
          class="select select-sm select-bordered"
          value={f().state}
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
          value={f().eval}
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
          value={f().model}
          onchange={(e) =>
            onFilter({ ...f(), model: (e.target as HTMLSelectElement).value })
          }
        >
          <option value="all">model: all</option>
          <For each={models()}>
            {(m) => <option value={m}>{esc(m)}</option>}
          </For>
        </select>
        <select
          class="select select-sm select-bordered"
          value={f().sort}
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

      <Show when={props.loading}>
        <p class="text-sm opacity-60 my-4">加载 runs…</p>
      </Show>
      <Show when={props.error}>
        <div class="alert alert-error my-4">
          <span>加载失败：{String(props.error)}</span>
          <button class="btn btn-sm" onclick={props.onRetry}>
            重试
          </button>
        </div>
      </Show>
      <Show when={!props.loading && !props.error && stats().total === 0}>
        <p class="text-sm opacity-60 my-4">暂无 run 记录。</p>
      </Show>
      <Show when={!props.loading && !props.error && stats().total > 0}>
        <div class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>run</th>
                <th>exit</th>
                <th>eval</th>
                <th>score</th>
                <th>model</th>
                <th class="text-right" title="模型请求次数">req</th>
                <th class="text-right" title="input+output+cache+reasoning 总和">tokens</th>
                <th class="text-right" title="session 时间戳跨度">wall</th>
                <th>artifact modified (UTC)</th>
              </tr>
            </thead>
            <tbody>
              <Show when={rows().length === 0}>
                <tr>
                  <td colspan="9" class="text-center opacity-50 py-4">
                    筛选无结果{" "}
                    <button
                      class="btn btn-xs btn-ghost"
                      onclick={() =>
                        onFilter({
                          state: "all",
                          eval: "all",
                          model: "all",
                          sort: f().sort,
                        })
                      }
                    >
                      清除筛选
                    </button>
                  </td>
                </tr>
              </Show>
              <For each={rows()}>
                {(r) => (
                  <tr
                    class="hover cursor-pointer"
                    onclick={() => onSelect(r.id)}
                  >
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
                      <span
                        class={"badge badge-sm " + evalBadge(r.evalStatus)}
                        title={r.evalStatus === "incomplete" ? "agent 超时或崩溃，pack 未产出，评测提前终止" : undefined}
                      >
                        {esc(r.evalStatus)}
                      </span>
                    </td>
                    <td
                      class="font-mono text-xs"
                      title={r.evalStatus === "incomplete" ? "pack 未产出，仅执行 2 项静态检查，运行时检查未执行" : "16 项静态检查 + 8 项运行时验证 = 24 项"}
                    >
                      {esc(r.evalScore ?? "-")}
                      {r.evalStatus === "incomplete" && r.evalScore && (
                        <span class="text-xs opacity-50 ml-1">(仅静态)</span>
                      )}
                    </td>
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
      </Show>
    </div>
  );
}
