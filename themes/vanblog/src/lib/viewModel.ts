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
 * - tagNum 按原版 `getTagsWithArticle(false)` 语义：只统计**已发布文章实际引用**的去重 tag，
 *   排除 admin 单独创建但未被文章引用的「孤儿 tag」，避免数字虚高。
 */
export async function getAuthorCardProps(
  pb: VanblogClient,
  site: Partial<Site> | null
): Promise<AuthorCardProps> {
  const [posts, categories, tagsOnPosts] = await Promise.all([
    safe(() => pb.vanblog.posts.listPublished(1, 1, { fields: 'id' }), 'vm-posts'),
    safe(() => pb.collection('categories').getFullList({ fields: 'id' }), 'vm-categories'),
    safe(() => pb.vanblog.posts.listPublished(1, 500, { fields: 'tags' }), 'vm-tags'),
  ]);

  const tagSet = new Set<string>();
  for (const p of tagsOnPosts.data?.items ?? []) {
    for (const t of p.tags ?? []) if (t) tagSet.add(t);
  }

  return {
    author: site?.author || site?.siteName || 'Vanblog',
    desc: site?.authDesc || site?.siteDesc || '',
    logo: site?.authorLogo || site?.siteLogo || '',
    logoDark: site?.authorLogoDark || site?.siteLogoDark || '',
    postNum: posts.data?.totalItems ?? 0,
    categoryNum: categories.data?.length ?? 0,
    tagNum: tagSet.size,
    socials: site?.socials ?? [],
    showRSS: site?.displayOptions?.showRSS !== false,
  };
}
