/**
 * 站内路径统一加 Astro base 前缀。
 *
 * 主题以 base=/themes/<name>/ 运行（dev 直访与生产 Caddy 拓扑一致：
 * 静态件与 fallback 都保留前缀转发）。原版裸根路径（/post/x、/page/2）
 * 在此拓扑下必须带前缀才是有效路由。
 *
 * 排除（平台根路径，不属于主题 base）：
 * - /admin/**（管理面板 SSR app，base="/"）
 * - /api/**（Go 层平台端点）
 * - 外链与非根相对路径原样返回。
 */
export const withBase = (path: string): string => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/')) return path;
  if (base && (path === base || path.startsWith(base + '/'))) return path;
  return base + path;
};

/**
 * 文章路径(上游 utils/getArticlePath 语义 + 前导斜杠归一):
 * 平台 pathname 存储混用 "/slug"/"slug" 两种形态(种子/导入来源不一),
 * 链接与查询统一取无前导斜杠形态;无 pathname 回落 id。
 */
export function articlePath(pathname?: string | null, id?: string | null): string {
  const p = pathname ? pathname.replace(/^\/+/, '') : '';
  return p || (id ?? '');
}
