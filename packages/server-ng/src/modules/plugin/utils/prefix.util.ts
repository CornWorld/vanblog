/**
 * Minimal helper to namespace strings with a pluginId.
 * Usage examples:
 *  - withPluginPrefix('cat-plugin', 'cache', 'hits') => 'cat-plugin:cache:hits'
 *  - withPluginPrefix('email-plugin', 'event', 'article.published') => 'email-plugin:event:article.published'
 *
 * Intentionally simple: no magic, no global prefixes. Plugins can choose
 * what to pass as parts; we just join with ':'.
 */
export function withPluginPrefix(
  pluginId: string,
  ...parts: Array<string | number | null | undefined>
): string {
  const cleaned = parts
    .filter((p) => p !== undefined && p !== null)
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0);
  return [pluginId, ...cleaned].join(':');
}
