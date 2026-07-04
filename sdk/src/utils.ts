/**
 * Extract and sanitize a page number from URL search params.
 * Returns 1 for missing, NaN, or non-positive values.
 */
export function getPage(params: URLSearchParams, key = 'page'): number {
  return Math.max(1, parseInt(params.get(key) || '1', 10) || 1);
}

/**
 * Build a pagination URL, preserving existing search params and
 * overriding the page key. Returns a path-relative string like "/admin?page=3".
 */
export function buildPageHref(
  base: string,
  params: URLSearchParams,
  page: number,
  pageKey = 'page',
): string {
  const p = new URLSearchParams(params);
  p.set(pageKey, String(page));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}
