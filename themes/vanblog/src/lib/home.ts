/**
 * 首页 / 分页页共享数据加载（原版 getIndexPageProps / getPagePagesProps 语义）。
 * index 与 /page/[p] 唯一差异是页码，取数与概览渲染统一在此。
 */
import { safe, stripMarkdown } from '@vanblog/sdk';
import type { VanblogClient, PostExpand } from '@vanblog/sdk';
import { renderMarkdown } from '@vanblog/base/lib/markdown/renderer';
import { sanitizeHtml } from './sanitizeHtml';

export interface HomeFeed {
  loadError: boolean;
  posts: PostExpand[];
  totalPages: number;
  /** 每篇文章的概览 HTML（与 posts 按下标对齐） */
  overviews: string[];
  /** keywords = 分类名 + 标签名去重（原版 getArticlesKeyWord） */
  keywords: string;
}

export async function loadHomeFeed(
  pb: VanblogClient,
  page: number,
  perPage = 5,
): Promise<HomeFeed> {
  const { data: result, error } = await safe(
    // 原版首页不传排序 → 服务端默认置顶优先（-top,-created）
    () => pb.vanblog.posts.listPublished(page, perPage, { expand: 'category,tags', sort: '-top,-created' }),
    'home',
  );
  const posts = result?.items ?? [];
  const totalPages = result?.totalPages ?? 1;

  const keywords = Array.from(
    new Set(
      posts.flatMap((p) =>
        [p.expand?.category?.name, ...(p.expand?.tags ?? []).map((t) => t.name)].filter(Boolean),
      ) as string[],
    ),
  ).join(',');

  // 首页概览：渲染真实 Markdown（原版 PostCard type="overview"，截到 <!-- more -->）。
  const overviews = await Promise.all(
    posts.map(async (post) => {
      const md = post.content || '';
      const parts = md.split('<!-- more -->');
      // 无 more 标记时先 strip 成纯文本再截断(#410:原始 markdown 截断会切碎链接)
      const overviewMd = parts.length > 1 ? parts[0] : stripMarkdown(md, 50);
      if (!overviewMd.trim()) return '';
      try {
        const { code } = await renderMarkdown(overviewMd);
        return sanitizeHtml(code);
      } catch (e) {
        console.error('[home] overview render:', e);
        return '';
      }
    }),
  );

  return { loadError: !!error, posts, totalPages, overviews, keywords };
}
