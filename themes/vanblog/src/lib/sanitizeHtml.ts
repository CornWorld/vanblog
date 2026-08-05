/**
 * Strip constructs that could execute scripts from rendered Markdown HTML
 * before it is injected via set:html (stored-XSS defense). The markdown
 * pipeline only emits safe elements, but authors can embed raw HTML in posts,
 * which the pipeline passes through unchanged.
 *
 * Shared by the article page and the homepage overview cards.
 */
export function sanitizeHtml(html: string): string {
  return html
    // Remove executable/embedding elements (and their content).
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, '')
    .replace(/<object\b[^>]*\/?>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<base\b[^>]*\/?>/gi, '')
    .replace(/<link\b[^>]*\/?>/gi, '')
    .replace(/<meta\b[^>]*\/?>/gi, '')
    // Strip event-handler attributes (never emitted by the markdown pipeline).
    .replace(/\s+on[a-z][a-z0-9_]*\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralize script-capable URL schemes in link/embed attributes.
    .replace(/(\s(?:href|src|xlink:href|action)\s*=\s*)(["'])\s*(?:javascript|vbscript)\s*:[^"'<]*\2/gi, '$1$2#')
    .replace(/(\s(?:href|src)\s*=\s*)(["'])data\s*:\s*text\s*\/\s*html[^"'<]*\2/gi, '$1$2#')
    // Remove srcdoc (only meaningful on <iframe>; defense in depth).
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}
