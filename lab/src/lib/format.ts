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

export const fmtCost = (c?: number | null) =>
  c != null && c > 0 ? "$" + c.toFixed(4) : "-";

/**
 * Lightweight JSON syntax highlighter — no dependencies.
 * Returns an HTML string with <span> tags using daisyUI color classes.
 * Input is HTML-escaped first to prevent XSS.
 */
export function highlightJson(str: string): string {
  // First HTML-escape to prevent injection
  const escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Then wrap JSON tokens in colored spans.
  // Order matters: process strings first (they may contain colons, braces etc.)
  return escaped.replace(
    // Match: "key": value | "string" | number | boolean | null
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b(?:true|false|null)\b)/g,
    (
      _match: string,
      key?: string,
      strVal?: string,
      num?: string,
      bool?: string
    ): string => {
      if (key) {
        // JSON key (includes trailing colon) — info color
        return `<span class="text-info">${key}</span>`;
      }
      if (strVal) {
        // String value — success (green)
        return `<span class="text-success">${strVal}</span>`;
      }
      if (num) {
        // Number — warning (amber)
        return `<span class="text-warning">${num}</span>`;
      }
      if (bool) {
        // Boolean/null — error (red)
        return `<span class="text-error">${bool}</span>`;
      }
      return _match;
    }
  );
}
