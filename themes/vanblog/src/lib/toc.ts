/**
 * TOC 辅助：从渲染后的 Markdown HTML 提取标题，供侧栏目录与页面判断共用。
 * 集中一处、类型化，避免在原版里 `hasToc`（utils）与组件内联解析各自为政。
 */

export interface TocItem {
  id: string;
  tag: "h1" | "h2" | "h3" | "h4";
  text: string;
  /** 0 = h1，1 = h2，2 = h3，3 = h4 */
  level: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * 从渲染后的 HTML 提取带 `id` 的 h2/h3 标题（markdown 管线的标题锚点）。
 * @returns 按文档顺序排列的标题列表；无标题时为空数组。
 */
export function extractHeadings(html: string): TocItem[] {
  const items: TocItem[] = [];
  // 用 \bid= 词边界避免误匹配 data-id（属性顺序变化时仍可靠）。
  // 覆盖 h1–h4（原版 parseNavStructure 支持 h1–h6，h5/h6 极罕见，取前四级）。
  const re = /<(h[1-4])[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  const levelMap: Record<string, number> = { h1: 0, h2: 1, h3: 2, h4: 3 };
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const tag = match[1] as TocItem["tag"];
    const text = decodeEntities(match[3].replace(/<[^>]*>/g, "").trim());
    if (text) items.push({ id: match[2], tag, text, level: levelMap[tag] });
  }

  return items;
}

/** 文章是否含可生成目录的标题（h1–h4 带 id）。 */
export function hasHeadings(html: string): boolean {
  return /<h[1-4][^>]*\bid=/.test(html);
}
