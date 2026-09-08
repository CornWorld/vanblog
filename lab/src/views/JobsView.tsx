import { Show, For, createSignal, createResource } from "solid-js";
import { A } from "@solidjs/router";
import { api, type JobEntry, type LastRun } from "../api";

const sevBadge: Record<string, string> = {
  critical: "badge-error",
  high: "badge-error",
  medium: "badge-warning",
  low: "badge-info",
};

export function JobsView() {
  return (
    <div class="max-w-6xl mx-auto p-6">
      <p class="text-sm mb-2">
        <A href="/" class="link">
          ← Agent Experiment Reports
        </A>
      </p>
      <h1 class="text-2xl font-bold mb-1">Security Jobs</h1>
      <p class="text-sm opacity-60 mb-4">
        黑盒不变量验证:对本地实例跑
        <code class="mx-1">scripts/pentest/nuclei-run.mjs</code>
        (模板 = docs/security-invariants.md 的黑盒化)。仅允许 127.0.0.1 /
        localhost 目标;seed 需要 artifacts-server 进程持有
        PB_ADMIN_EMAIL/PB_ADMIN_PASSWORD。
      </p>
      <NucleiJob />
    </div>
  );
}

function NucleiJob() {
  const [target, setTarget] = createSignal("http://127.0.0.1:8090");
  const [seed, setSeed] = createSignal(true);
  const [cleanup, setCleanup] = createSignal(true);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const [jobs, { refetch }] = createResource(api.jobs);
  const [lastRun] = createResource(api.lastRun);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.runJob({ target: target(), seed: seed(), cleanup: cleanup() });
      await refetch();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div class="card bg-base-200 p-4 mb-4">
        <div class="flex flex-wrap gap-2 items-center">
          <input
            class="input input-sm input-bordered w-72 font-mono"
            value={target()}
            oninput={(e) => setTarget(e.currentTarget.value)}
            placeholder="http://127.0.0.1:8090"
          />
          <label class="label cursor-pointer gap-1 text-sm">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
            />
            seed fixture
          </label>
          <label class="label cursor-pointer gap-1 text-sm">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              checked={cleanup()}
              onchange={(e) => setCleanup(e.currentTarget.checked)}
            />
            cleanup
          </label>
          <button
            class="btn btn-sm btn-primary"
            disabled={busy()}
            onclick={run}
          >
            {busy() ? "触发中…" : "运行"}
          </button>
        </div>
        <Show when={error()}>
          <p class="text-error text-sm mt-2">{error()}</p>
        </Show>
      </div>
      <LastRunCard run={lastRun() ?? null} />
      <JobHistory jobs={jobs() ?? []} onRefresh={() => void refetch()} />
    </>
  );
}

function LastRunCard(props: { run: LastRun | null }) {
  const run = () => props.run;
  const findings = () => run()?.findings ?? [];
  return (
    <div class="card bg-base-200 p-4 mb-4">
      <div class="flex items-center gap-2 mb-2">
        <h2 class="font-semibold">最近一次运行</h2>
        <Show when={run()}>
          <span class="text-xs opacity-60">
            {run()!.target} @ {fmt(run()!.at)}
          </span>
        </Show>
      </div>
      <Show
        when={run()}
        fallback={<p class="text-sm opacity-60">尚无运行记录</p>}
      >
        <Show
          when={findings().length > 0}
          fallback={
            <p class="text-success text-sm">
              无违规 — 不变量全部通过 ✓(seed 模式下未建 fixture 的检测项为空跑)
            </p>
          }
        >
          <table class="table table-sm">
            <thead>
              <tr>
                <th>severity</th>
                <th>模板</th>
                <th>matched</th>
              </tr>
            </thead>
            <tbody>
              <For each={findings()}>
                {(f) => (
                  <tr>
                    <td>
                      <span
                        class={`badge badge-sm ${
                          sevBadge[f.info?.severity ?? ""] ??
                          "badge-ghost"
                        }`}
                      >
                        {f.info?.severity ?? "?"}
                      </span>
                    </td>
                    <td>{f.info?.name ?? "?"}</td>
                    <td class="font-mono text-xs">{f.matched_at ?? f.host}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </Show>
    </div>
  );
}

function JobHistory(props: { jobs: JobEntry[]; onRefresh: () => void }) {
  const jobs = () => props.jobs ?? [];
  return (
    <div>
      <div class="flex items-center gap-2 mb-2">
        <h2 class="font-semibold">历史任务</h2>
        <button class="btn btn-ghost btn-xs" onclick={props.onRefresh}>
          刷新
        </button>
      </div>
      <Show when={jobs().length > 0} fallback={<p class="text-sm opacity-60">无任务</p>}>
        <table class="table table-sm">
          <thead>
            <tr>
              <th>时间</th>
              <th>target</th>
              <th>seed</th>
              <th>状态</th>
              <th>findings</th>
            </tr>
          </thead>
          <tbody>
            <For each={jobs()}>
              {(j) => (
                <tr>
                  <td>{fmt(j.at)}</td>
                  <td class="font-mono text-xs">{j.target}</td>
                  <td>{j.seed ? "✓" : ""}</td>
                  <td>
                    <span
                      class={`badge badge-sm ${
                        j.status === "done" ? "badge-success" : "badge-warning"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td>{j.findings ?? "—"}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}

const fmt = (iso: string) => iso.replace("T", " ").slice(0, 19);
