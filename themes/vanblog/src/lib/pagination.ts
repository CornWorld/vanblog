/**
 * 分页逻辑：从原版 `PageNav/core.ts` 的 calItemList 移植，改为 `?page=N` 查询串。
 * 输出带「上一页/下一页 + 页码列表 + …省略号 + 当前页高亮」的条目序列。
 */

export type PageItemType =
  | 'pre-btn'
  | 'pre-btn-disable'
  | 'next-btn'
  | 'next-btn-disable'
  | 'link'
  | 'link-cur'
  | 'pre-more'
  | 'next-more';

export interface PageItem {
  type: PageItemType;
  href: string;
  page: number;
}

export interface PaginationProps {
  /** 当前页码（从 1 开始） */
  current: number;
  /** 总页数 */
  totalPages: number;
  /** 分页基础 URL，如 "/" 或 "/tags?x=1"；页码以 `?page=N` 追加 */
  baseUrl: string;
}

function pageHref(baseUrl: string, page: number): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}page=${page}`;
}

export function calPageItems(props: PaginationProps): PageItem[] {
  const { current, totalPages, baseUrl } = props;
  const pageNum = Math.max(1, totalPages);
  const cur = Math.min(Math.max(1, current), pageNum);
  const res: PageItem[] = [];

  // 上一页
  res.push(
    cur <= 1
      ? { type: 'pre-btn-disable', href: pageHref(baseUrl, 1), page: 1 }
      : { type: 'pre-btn', href: pageHref(baseUrl, cur - 1), page: cur - 1 },
  );

  const moreHref = Math.min(cur + 5, pageNum);
  const lessHref = Math.max(cur - 5, 1);

  if (pageNum <= 7) {
    // 页数少，全部渲染
    for (let i = 1; i <= pageNum; i++) {
      res.push({ type: i === cur ? 'link-cur' : 'link', href: pageHref(baseUrl, i), page: i });
    }
  } else if (cur <= 4) {
    // 前 4 页：xxxx, •••, N
    for (let i = 1; i <= 4; i++) {
      res.push({ type: i === cur ? 'link-cur' : 'link', href: pageHref(baseUrl, i), page: i });
    }
    res.push({ type: 'next-more', href: pageHref(baseUrl, moreHref), page: moreHref });
    res.push({ type: 'link', href: pageHref(baseUrl, pageNum), page: pageNum });
  } else if (pageNum - cur < 4) {
    // 倒数 4 页内：1, •••, xxxx
    res.push({ type: 'link', href: pageHref(baseUrl, 1), page: 1 });
    res.push({ type: 'pre-more', href: pageHref(baseUrl, lessHref), page: lessHref });
    for (let i = pageNum - 3; i <= pageNum; i++) {
      res.push({ type: i === cur ? 'link-cur' : 'link', href: pageHref(baseUrl, i), page: i });
    }
  } else {
    // 中间：1, •••, 当前±1, •••, N
    res.push({ type: 'link', href: pageHref(baseUrl, 1), page: 1 });
    res.push({ type: 'pre-more', href: pageHref(baseUrl, lessHref), page: lessHref });
    res.push({ type: 'link', href: pageHref(baseUrl, cur - 1), page: cur - 1 });
    res.push({ type: 'link-cur', href: pageHref(baseUrl, cur), page: cur });
    res.push({ type: 'link', href: pageHref(baseUrl, cur + 1), page: cur + 1 });
    res.push({ type: 'next-more', href: pageHref(baseUrl, moreHref), page: moreHref });
    res.push({ type: 'link', href: pageHref(baseUrl, pageNum), page: pageNum });
  }

  // 下一页
  res.push(
    cur >= pageNum
      ? { type: 'next-btn-disable', href: pageHref(baseUrl, pageNum), page: pageNum }
      : { type: 'next-btn', href: pageHref(baseUrl, cur + 1), page: cur + 1 },
  );

  return res;
}
