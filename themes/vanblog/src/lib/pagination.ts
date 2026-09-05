/**
 * 分页逻辑：原版 `PageNav/core.ts` 的 calItemList 移植（行为 1:1）。
 * URL 形态与原版一致：第 1 页 = `base`（首页即 "/"），N≥2 = `${more}/${N}`（"/page/2"）。
 * 输出「上一页/下一页 + 页码 + •••省略号 + 当前页高亮」条目序列。
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
  /** 第 1 页地址（首页 "/"；tags/categories 列表则为列表页自身） */
  base: string;
  /** 翻页地址前缀（首页为 "/page"，即 /page/2…） */
  more: string;
}

export function calPageItems(props: PaginationProps): PageItem[] {
  const { current, totalPages, base, more } = props;
  const pageNum = Math.max(1, totalPages);
  const cur = Math.min(Math.max(1, current), pageNum);
  const res: PageItem[] = [];

  const pageHref = (i: number) => (i <= 1 ? base : `${more}/${i}`);

  // 跳转省略号的目标页（原版 moreHref/lessHref）
  const moreHref = Math.min(cur + 5, pageNum);
  const lessHref = Math.max(cur - 5, 1);

  // 上一页
  if (cur <= 1) {
    res.push({ type: 'pre-btn-disable', href: base, page: 1 });
  } else if (cur - 1 === 1) {
    res.push({ type: 'pre-btn', href: base, page: 1 });
  } else {
    res.push({ type: 'pre-btn', href: `${more}/${cur - 1}`, page: cur - 1 });
  }

  if (pageNum <= 7) {
    // 页数少，全部渲染
    for (let i = 1; i <= pageNum; i++) {
      res.push({ type: i === cur ? 'link-cur' : 'link', href: pageHref(i), page: i });
    }
  } else if (cur <= 4) {
    // 前 4 页：xxxx, •••, N
    for (let i = 1; i <= 4; i++) {
      res.push({ type: i === cur ? 'link-cur' : 'link', href: pageHref(i), page: i });
    }
    res.push({ type: 'next-more', href: `${more}/${moreHref}`, page: moreHref });
    res.push({ type: 'link', href: `${more}/${pageNum}`, page: pageNum });
  } else if (pageNum - cur < 4) {
    // 倒数 4 页内：1, •••, xxxx
    res.push({ type: 'link', href: base, page: 1 });
    res.push({ type: 'pre-more', href: pageHref(lessHref), page: lessHref });
    for (let i = pageNum - 3; i <= pageNum; i++) {
      res.push({ type: i === cur ? 'link-cur' : 'link', href: `${more}/${i}`, page: i });
    }
  } else {
    // 中间：1, •••, 当前±1, •••, N
    res.push({ type: 'link', href: base, page: 1 });
    res.push({ type: 'pre-more', href: pageHref(lessHref), page: lessHref });
    res.push({ type: 'link', href: `${more}/${cur - 1}`, page: cur - 1 });
    res.push({ type: 'link-cur', href: `${more}/${cur}`, page: cur });
    res.push({ type: 'link', href: `${more}/${cur + 1}`, page: cur + 1 });
    res.push({ type: 'next-more', href: `${more}/${moreHref}`, page: moreHref });
    res.push({ type: 'link', href: `${more}/${pageNum}`, page: pageNum });
  }

  // 下一页
  if (cur >= pageNum) {
    res.push({ type: 'next-btn-disable', href: `${more}/${pageNum}`, page: pageNum });
  } else {
    res.push({ type: 'next-btn', href: `${more}/${cur + 1}`, page: cur + 1 });
  }

  return res;
}
