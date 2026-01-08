import { Injectable, Inject } from '@nestjs/common';
import { analytics, articles } from '@vanblog/shared/drizzle';
import { eq, and, sql, desc } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../../database';
import { AnalyticsType } from '../entities/analytics.entity';

export interface ArticleStats {
  articleId: number;
  title: string;
  views: number;
  uniqueVisitors: number;
  avgReadTime: number;
}

@Injectable()
export class ArticleStatsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async recordArticleView(articleId: number, ip: string, userAgent?: string): Promise<void> {
    const article = await this.db
      .select({ id: articles.id, pathname: articles.pathname })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (article.length === 0) {
      return;
    }

    await this.db.insert(analytics).values({
      type: AnalyticsType.PAGEVIEW,
      path: `/article/${article[0].pathname ?? String(article[0].id)}`,
      ip,
      userAgent,
      data: { articleId },
    });

    // 更新文章浏览次数
    await this.db
      .update(articles)
      .set({
        viewer: sql`${articles.viewer} + 1`,
      })
      .where(eq(articles.id, articleId));
  }

  async recordArticleViewByPathname(
    pathname: string,
    ip: string,
    userAgent?: string,
  ): Promise<void> {
    const article = await this.db
      .select({ id: articles.id, pathname: articles.pathname })
      .from(articles)
      .where(eq(articles.pathname, pathname))
      .limit(1);

    if (article.length === 0) {
      return;
    }

    const articleId = article[0].id;
    await this.recordArticleView(articleId, ip, userAgent);
  }

  async getTopArticles(limit = 10): Promise<ArticleStats[]> {
    // 先获取浏览统计（从 PAGEVIEW 类型的记录）
    const articleIdExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.articleId') AS INTEGER)`;

    const pageViewStats = await this.db
      .select({
        articleId: articleIdExpr,
        title: articles.title,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .leftJoin(articles, sql`${articleIdExpr} = ${articles.id}`)
      .where(
        and(
          eq(analytics.type, AnalyticsType.PAGEVIEW),
          sql`json_extract(${analytics.data}, '$.articleId') IS NOT NULL`,
        ),
      )
      .groupBy(articleIdExpr, articles.title)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    // 获取阅读时长（从 EVENT 类型的记录）
    const articleIds = pageViewStats.map((stat) => stat.articleId);
    const durationExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.duration') AS INTEGER)`;

    const readingTimeStats =
      articleIds.length > 0
        ? await this.db
            .select({
              articleId: articleIdExpr,
              avgReadTime: sql<number>`avg(${durationExpr})`,
            })
            .from(analytics)
            .where(
              and(
                eq(analytics.type, AnalyticsType.EVENT),
                sql`json_extract(${analytics.data}, '$.event') = 'reading_time'`,
                sql`json_extract(${analytics.data}, '$.articleId') IS NOT NULL`,
                sql`json_extract(${analytics.data}, '$.duration') IS NOT NULL`,
                sql`${articleIdExpr} IN ${sql.raw(`(${articleIds.join(',')})`)}`,
              ),
            )
            .groupBy(articleIdExpr)
        : [];

    // 合并结果
    const readingTimeMap = new Map(readingTimeStats.map((stat) => [stat.articleId, stat.avgReadTime]));

    return pageViewStats.map((row) => ({
      articleId: row.articleId,
      title: row.title && row.title.length > 0 ? row.title : 'Untitled',
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
      avgReadTime: (readingTimeMap.get(row.articleId) ?? 0) > 0 ? readingTimeMap.get(row.articleId)! : 0,
    }));
  }

  async getArticleStats(articleId: number): Promise<ArticleStats | null> {
    const articleIdExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.articleId') AS INTEGER)`;

    // 获取文章信息
    const articleInfo = await this.db
      .select({
        title: articles.title,
      })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    if (articleInfo.length === 0) {
      return null;
    }

    // 获取浏览统计（从 PAGEVIEW 类型的记录）
    const pageViewResult = await this.db
      .select({
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
      })
      .from(analytics)
      .where(and(eq(analytics.type, AnalyticsType.PAGEVIEW), sql`${articleIdExpr} = ${articleId}`));

    // count(*) without group by always returns one row
    const views = pageViewResult[0].views;
    if (views === 0) {
      // No views found, return null
      return null;
    }

    // 获取阅读时长（从 EVENT 类型的记录）
    const durationExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.duration') AS INTEGER)`;
    const readingTimeResult = await this.db
      .select({
        avgReadTime: sql<number>`avg(${durationExpr})`,
      })
      .from(analytics)
      .where(
        and(
          eq(analytics.type, AnalyticsType.EVENT),
          sql`json_extract(${analytics.data}, '$.event') = 'reading_time'`,
          sql`json_extract(${analytics.data}, '$.articleId') IS NOT NULL`,
          sql`json_extract(${analytics.data}, '$.duration') IS NOT NULL`,
          sql`${articleIdExpr} = ${articleId}`,
        ),
      );

    const avgReadTime = readingTimeResult.length > 0 ? readingTimeResult[0].avgReadTime : 0;

    return {
      articleId,
      title: articleInfo[0].title && articleInfo[0].title.length > 0 ? articleInfo[0].title : 'Untitled',
      views,
      uniqueVisitors: pageViewResult[0].uniqueVisitors,
      avgReadTime: avgReadTime > 0 ? avgReadTime : 0,
    };
  }

  async recordReadingTime(articleId: number, duration: number, ip: string): Promise<void> {
    await this.db.insert(analytics).values({
      type: AnalyticsType.EVENT,
      path: `/article/${String(articleId)}`,
      ip,
      data: { articleId, duration, event: 'reading_time' },
    });
  }
}
