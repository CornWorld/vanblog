// PocketBase returns datetime columns as "2026-07-02 12:30:08.585Z" —
// space between date and time, NOT the ISO 8601 "T". Node's V8 accepts
// this in non-strict mode but Astro SSR runs with strict parsing enabled,
// so `new Date(raw)` returns Invalid Date.
//
// Always-normalize through this helper before constructing a Date.

/** Parse a PocketBase datetime string into a Date, or null if invalid/empty. */
export function parsePbDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const d = new Date(String(raw).replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

type FormatOpts = Intl.DateTimeFormatOptions;

/** Format a pb datetime as a localized string. Returns '—' on invalid input. */
export function formatPbDate(
  raw: string | undefined | null,
  opts: FormatOpts = { hour12: false },
  locale = 'zh-CN',
): string {
  const d = parsePbDate(raw);
  if (!d) return '—';
  return d.toLocaleString(locale, opts);
}

/** Format a pb datetime as a date-only string. */
export function formatPbDateOnly(
  raw: string | undefined | null,
  locale = 'zh-CN',
): string {
  const d = parsePbDate(raw);
  if (!d) return '—';
  return d.toLocaleDateString(locale);
}
