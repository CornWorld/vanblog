// PocketBase returns datetime columns as "2026-07-02 12:30:08.585Z" —
// space between date and time, NOT the ISO 8601 "T". Node's V8 accepts
// this in non-strict mode but Astro SSR runs with strict parsing enabled,
// so `new Date(raw)` returns Invalid Date.
//
// Always-normalize through this helper before constructing a Date.

/** Parse a PocketBase datetime string into a Date, or null if invalid/empty. */
export function parseDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

type FormatOpts = Intl.DateTimeFormatOptions;

/** Format a pb datetime as a localized string. Returns '—' on invalid input. */
export function fmtDateTime(
  raw: string | undefined | null,
  opts: FormatOpts = { hour12: false },
  locale = 'zh-CN',
): string {
  const d = parseDate(raw);
  if (!d) return '—';
  return d.toLocaleString(locale, opts);
}

/** Format a pb datetime as a date-only string. */
export function fmtDate(
  raw: string | undefined | null,
  locale = 'zh-CN',
): string {
  const d = parseDate(raw);
  if (!d) return '—';
  return d.toLocaleDateString(locale);
}

/** Format a pb datetime as a human-friendly relative time string (中文). */
export function fmtRelativeTime(raw: string | undefined | null): string {
  if (!raw) return '—';
  const d = new Date(raw.replace(' ', 'T'));
  if (isNaN(d.getTime())) return raw;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return d.toLocaleString('zh-CN', { hour12: false });
}
