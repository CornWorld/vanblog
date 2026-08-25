import { createSignal, createMemo, createResource } from "solid-js";
import { Route, useParams } from "@solidjs/router";
import { api } from "./api";
import { compareScore } from "./lib/format";
import { RunList, type RunFilter } from "./views/RunList";
import { RunDetail } from "./views/RunDetail";
import { SessionDetail } from "./views/SessionDetail";
export default function App() {
  const [filter, setFilter] = createSignal<RunFilter>({
    state: "all",
    eval: "all",
    model: "all",
    sort: "mtime-desc",
  });

  const [runs, { refetch: refetchRuns }] = createResource(api.runs);

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
          return compareScore(a, b, "desc");
        case "score-asc":
          return compareScore(a, b, "asc");
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

  // Route page components — useNavigate/useParams MUST be called here
  // (inside <Route component={...}>), not in App (direct <Router> child).
  function ListPage() {
    return (
      <RunList
        rows={rows()}
        models={models()}
        stats={stats()}
        filter={filter()}
        onFilter={setFilter}
        loading={runs.loading}
        error={runs.error}
        onRetry={() => void refetchRuns()}
      />
    );
  }
  function DetailPage() {
    const p = useParams();
    const id = () => p.id!;
    return <RunDetail id={id()} />;
  }
  function SessionPage() {
    const p = useParams();
    const id = () => p.id!;
    return <SessionDetail id={id()} />;
  }

  return (
    <>
      <Route path="/" component={ListPage} />
      <Route path="/runs/:id" component={DetailPage} />
      <Route path="/runs/:id/session" component={SessionPage} />
    </>
  );
}
