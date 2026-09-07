import { safe } from '@vanblog/sdk';
import type { VanblogClient, Site, SocialItem } from '@vanblog/sdk';

/**
 * View-model helpers, mirroring the original mereithhh vanblog
 * `utils/getPageProps.ts` + `utils/getLayoutProps.ts` (getAuthorCardProps).
 *
 * The original site passes an AuthorCard as the persistent right sidebar on
 * every content page (index / tags / timeline / categories / about / link),
 * and its props come from a shared view model rather than ad-hoc page fetches.
 * This file centralizes that data contract for the Astro rewrite.
 */
export interface AuthorCardProps {
  author: string;
  desc: string;
  logo: string;
  logoDark: string;
  postNum: number;
  categoryNum: number;
  tagNum: number;
  socials: SocialItem[];
  showRSS: boolean;
}

/**
 * Build AuthorCard sidebar props: author identity + post/category/tag counts.
 * - postNum / categoryNum 与口径同原版（发布文章总数 / 全量分类数）。
 * - tagNum 对齐原版 getAuthorCardProps:全量 tag 数(原版 data.tags 含未被
 *   文章引用的孤儿 tag,如需排除应同时改原版,不在此分叉)。
 */
export async function getAuthorCardProps(
  pb: VanblogClient,
  site: Partial<Site> | null
): Promise<AuthorCardProps> {
  // 串行:同一 pb client 并发请求触发 SDK auto-cancel(posts 请求被取消 →
  // postNum 落 0,截图实证),与 lib/home.ts 同因。
  const posts = await safe(() => pb.vanblog.posts.listPublished(1, 1, { fields: 'id' }), 'vm-posts');
  const categories = await safe(() => pb.collection('categories').getFullList({ fields: 'id' }), 'vm-categories');
  const tags = await safe(() => pb.collection('tags').getFullList({ fields: 'id' }), 'vm-tags');

  return {
    author: site?.author || site?.siteName || 'Vanblog',
    desc: site?.authDesc || site?.siteDesc || '',
    logo: site?.authorLogo || site?.siteLogo || '',
    logoDark: site?.authorLogoDark || site?.siteLogoDark || '',
    postNum: posts.data?.totalItems ?? 0,
    categoryNum: categories.data?.length ?? 0,
    tagNum: tags.data?.length ?? 0,
    socials: site?.socials ?? [],
    showRSS: site?.displayOptions?.showRSS !== false,
  };
}
