import { Injectable, Inject } from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';

import { DATABASE_CONNECTION } from '../../../database';
import { analytics, articles } from '../../../database/schema';
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
    private readonly db: LibSQLDatabase,
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
      data: JSON.stringify({ articleId }),
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
    // 已统一数据：仅使用新字段 articleId / duration，类型为 pageview
    const articleIdExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.articleId') AS INTEGER)`;
    const durationExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.duration') AS INTEGER)`;

    const result = await this.db
      .select({
        articleId: articleIdExpr,
        title: articles.title,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
        avgReadTime: sql<number>`avg(${durationExpr})`,
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

    return result.map((row) => ({
      articleId: row.articleId,
      title: row.title ?? 'Untitled',
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
      avgReadTime: row.avgReadTime > 0 ? row.avgReadTime : 0,
    }));
  }

  async getArticleStats(articleId: number): Promise<ArticleStats | null> {
    // 已统一数据：仅使用新字段 articleId / duration，类型为 pageview
    const articleIdExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.articleId') AS INTEGER)`;
    const durationExpr = sql<number>`CAST(json_extract(${analytics.data}, '$.duration') AS INTEGER)`;

    const result = await this.db
      .select({
        title: articles.title,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
        avgReadTime: sql<number>`avg(${durationExpr})`,
      })
      .from(analytics)
      .leftJoin(articles, eq(articles.id, articleId))
      .where(and(eq(analytics.type, AnalyticsType.PAGEVIEW), sql`${articleIdExpr} = ${articleId}`))
      .groupBy(articles.title);

    if (result.length === 0) {
      return null;
    }

    return {
      articleId,
      title: result[0].title ?? 'Untitled',
      views: result[0].views,
      uniqueVisitors: result[0].uniqueVisitors,
      avgReadTime: result[0].avgReadTime > 0 ? result[0].avgReadTime : 0,
    };
  }

  async recordReadingTime(articleId: number, duration: number, ip: string): Promise<void> {
    await this.db.insert(analytics).values({
      type: AnalyticsType.EVENT,
      path: `/article/${String(articleId)}`,
      ip,
      data: JSON.stringify({ articleId, duration, event: 'reading_time' }),
    });
  }
}
