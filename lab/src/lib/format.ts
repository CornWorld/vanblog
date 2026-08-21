import type { RunSummary } from "../api";

export const esc = (s: unknown) => String(s ?? "-");

export const fmtTime = (iso?: string) =>
  iso ? iso.slice(0, 19).replace("T", " ") : "-";

export const fmtSec = (s?: number | null) =>
  s != null ? s.toFixed(1) + "s" : "-";

export const fmtNum = (n?: number | null) =>
  n != null ? n.toLocaleString() : "-";

export const evalBadge = (st?: string | null) =>
  st === "passed"
    ? "badge-success"
    : st === "failed"
    ? "badge-error"
    : "badge-warning";

export const pctOf = (r: RunSummary) => {
  const m = r.evalScore?.match(/(\d+)\/(\d+)/);
  return m ? Math.round((parseInt(m[1]) / parseInt(m[2])) * 100) : -1;
};