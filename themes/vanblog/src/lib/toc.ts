/**
 * TOC 辅助：从渲染后的 Markdown HTML 提取标题，供侧栏目录与页面判断共用。
 * 集中一处、类型化，避免在原版里 `hasToc`（utils）与组件内联解析各自为政。
 */

export interface TocItem {
  id: string;
  tag: 'h2' | 'h3';
  text: string;
  level: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * 从渲染后的 HTML 提取带 `id` 的 h2/h3 标题（markdown 管线的标题锚点）。
 * @returns 按文档顺序排列的标题列表；无标题时为空数组。
 */
export function extractHeadings(html: string): TocItem[] {
  const items: TocItem[] = [];
  const h2Re = /<h2[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi;
  const h3Re = /<h3[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = h2Re.exec(html)) !== null) {
    const text = decodeEntities(match[2].replace(/<[^>]*>/g, '').trim());
    if (text) items.push({ id: match[1], tag: 'h2', text, level: 1 });
  }

  while ((match = h3Re.exec(html)) !== null) {
    const text = decodeEntities(match[2].replace(/<[^>]*>/g, '').trim());
    if (text) items.push({ id: match[1], tag: 'h3', text, level: 2 });
  }

  return items;
}

/** 文章是否含可生成目录的标题（h2/h3 带 id）。 */
export function hasHeadings(html: string): boolean {
  return /<(h2|h3)[^>]*\bid=/.test(html);
}
