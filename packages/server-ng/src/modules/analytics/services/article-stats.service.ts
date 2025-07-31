import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import { analytics, articles } from '../../../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
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
    const result = await this.db
      .select({
        articleId: sql<number>`CAST(json_extract(${analytics.data}, '$.articleId') as INTEGER)`,
        title: articles.title,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
        avgReadTime: sql<number>`avg(CAST(json_extract(${analytics.data}, '$.duration') as INTEGER))`,
      })
      .from(analytics)
      .leftJoin(
        articles,
        sql`CAST(json_extract(${analytics.data}, '$.articleId') as INTEGER) = ${articles.id}`,
      )
      .where(
        and(
          eq(analytics.type, AnalyticsType.PAGEVIEW),
          sql`json_extract(${analytics.data}, '$.articleId') is not null`,
        ),
      )
      .groupBy(sql`json_extract(${analytics.data}, '$.articleId')`, articles.title)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return result.map((row) => ({
      articleId: row.articleId,
      title: row.title ?? 'Untitled',
      views: row.views,
      uniqueVisitors: row.uniqueVisitors,
      avgReadTime: row.avgReadTime || 0,
    }));
  }

  async getArticleStats(articleId: number): Promise<ArticleStats | null> {
    const result = await this.db
      .select({
        title: articles.title,
        views: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(distinct ${analytics.ip})`,
        avgReadTime: sql<number>`avg(CAST(json_extract(${analytics.data}, '$.duration') as INTEGER))`,
      })
      .from(analytics)
      .leftJoin(articles, eq(articles.id, articleId))
      .where(
        and(
          eq(analytics.type, AnalyticsType.PAGEVIEW),
          sql`json_extract(${analytics.data}, '$.articleId') = ${articleId}`,
        ),
      )
      .groupBy(articles.title);

    if (result.length === 0) {
      return null;
    }

    return {
      articleId,
      title: result[0].title ?? 'Untitled',
      views: result[0].views,
      uniqueVisitors: result[0].uniqueVisitors,
      avgReadTime: result[0].avgReadTime || 0,
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
