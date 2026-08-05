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
 * Same three metrics the original AuthorCardProps carried (postNum /
 * catelogNum / tagNum), sourced from the PB collections.
 */
export async function getAuthorCardProps(
  pb: VanblogClient,
  site: Partial<Site> | null
): Promise<AuthorCardProps> {
  const [posts, categories, tags] = await Promise.all([
    safe(() => pb.vanblog.posts.listPublished(1, 1, { fields: 'id' }), 'vm-posts'),
    safe(() => pb.collection('categories').getFullList({ fields: 'id' }), 'vm-categories'),
    safe(() => pb.collection('tags').getFullList({ fields: 'id' }), 'vm-tags'),
  ]);

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
