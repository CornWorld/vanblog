import type { RunSummary } from "../api";

export const esc = (s: unknown) => String(s ?? "-");

export const fmtTime = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`;
};

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
  if (!m) return null;
  const passed = Number(m[1]);
  const total = Number(m[2]);
  return Number.isFinite(passed) &&
    Number.isFinite(total) &&
    total > 0 &&
    passed >= 0 &&
    passed <= total
    ? Math.round((passed / total) * 100)
    : null;
};

export const compareScore = (
  a: RunSummary,
  b: RunSummary,
  direction: "asc" | "desc"
) => {
  const ap = pctOf(a);
  const bp = pctOf(b);
  if (ap == null && bp == null) return 0;
  if (ap == null) return 1;
  if (bp == null) return -1;
  return direction === "desc" ? bp - ap : ap - bp;
};
