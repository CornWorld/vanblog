/* UPSTREAM: (seam 文件;对应上游 packages/website/api/search.ts@4b488500be8100b19772ec00d8315f343a6ac21e)
 * SEAM: 数据层 — 包 GET /api/vanblog/search(平台 Go 层,vault/internal/article)。
 * 计划契约:SearchHit{id,title,summary,category?,createdAt}。平台返回
 * {id,title,path,createdAt}(Go SearchResult,createdAt 为本波扩展);summary/category
 * 平台不提供,置空/缺省 — SearchCard 的 ArticleList 仅消费 id/title/createdAt。
 * 上游 fix → 不涉及本文件(端点在 vault)。
 */
export interface SearchHit {
  id: string;
  title: string;
  summary: string;
  category?: string;
  createdAt: string;
}

interface RawHit {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  category?: unknown;
  createdAt?: unknown;
}

export async function searchArticles(q: string, limit?: number): Promise<SearchHit[]> {
  const params = new URLSearchParams({ q });
  if (limit != null) params.set("limit", String(limit));
  const res = await fetch(`/api/vanblog/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`search failed: ${res.status}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return (data as RawHit[]).map((r) => ({
    id: typeof r.id === "string" ? r.id : String(r.id ?? ""),
    title: typeof r.title === "string" ? r.title : "",
    summary: typeof r.summary === "string" ? r.summary : "",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
  }));
}
