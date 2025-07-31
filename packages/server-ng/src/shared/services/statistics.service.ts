import { Injectable, Inject } from '@nestjs/common';
import { eq, sql, like } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { Database } from '../../db/connection';
import { categories, tags, articles } from '../../db/schema';
import {
  CategoryStatisticsDto,
  TagStatisticsDto,
  OverallStatisticsDto,
} from '../dto/statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async getOverallStatistics(): Promise<OverallStatisticsDto> {
    // Get category statistics
    const categoryStats = await this.getCategoryStatistics();

    // Get tag statistics
    const tagStats = await this.getTagStatistics();

    // Get overall article statistics
    const articleStats = await this.getArticleStatistics();

    return {
      totalCategories: categoryStats.length,
      totalTags: tagStats.length,
      totalArticles: articleStats.totalArticles,
      publishedArticles: articleStats.publishedArticles,
      privateArticles: articleStats.privateArticles,
      hiddenArticles: articleStats.hiddenArticles,
      totalViews: articleStats.totalViews,
      categories: categoryStats,
      tags: tagStats,
    };
  }

  private async getCategoryStatistics(): Promise<CategoryStatisticsDto[]> {
    const allCategories = await this.db.select().from(categories);

    const categoryStats = await Promise.all(
      allCategories.map(async (category) => {
        const stats = await this.db
          .select({
            articleCount: sql<number>`count(*)`,
            publishedCount: sql<number>`count(case when hidden = false and private = false then 1 end)`,
            privateCount: sql<number>`count(case when private = true then 1 end)`,
            totalViews: sql<number>`sum(viewer)`,
          })
          .from(articles)
          .where(eq(articles.category, category.name));

        return {
          id: category.id,
          name: category.name,
          slug: category.slug ?? undefined,
          articleCount: Number(stats[0]?.articleCount) || 0,
          publishedCount: Number(stats[0]?.publishedCount) || 0,
          privateCount: Number(stats[0]?.privateCount) || 0,
          totalViews: Number(stats[0]?.totalViews) || 0,
        };
      }),
    );

    return categoryStats;
  }

  private async getTagStatistics(): Promise<TagStatisticsDto[]> {
    const allTags = await this.db.select().from(tags);

    const tagStats = await Promise.all(
      allTags.map(async (tag) => {
        const stats = await this.db
          .select({
            articleCount: sql<number>`count(*)`,
            totalViews: sql<number>`sum(viewer)`,
          })
          .from(articles)
          .where(like(articles.tags, `%"${tag.name}"%`));

        return {
          id: tag.id,
          name: tag.name,
          slug: tag.slug ?? undefined,
          articleCount: Number(stats[0]?.articleCount) || 0,
          totalViews: Number(stats[0]?.totalViews) || 0,
        };
      }),
    );

    return tagStats;
  }

  private async getArticleStatistics(): Promise<{
    totalArticles: number;
    publishedArticles: number;
    privateArticles: number;
    hiddenArticles: number;
    totalViews: number;
  }> {
    const stats = await this.db
      .select({
        totalArticles: sql<number>`count(*)`,
        publishedArticles: sql<number>`count(case when hidden = false and private = false then 1 end)`,
        privateArticles: sql<number>`count(case when private = true then 1 end)`,
        hiddenArticles: sql<number>`count(case when hidden = true then 1 end)`,
        totalViews: sql<number>`sum(viewer)`,
      })
      .from(articles);

    return {
      totalArticles: Number(stats[0]?.totalArticles) || 0,
      publishedArticles: Number(stats[0]?.publishedArticles) || 0,
      privateArticles: Number(stats[0]?.privateArticles) || 0,
      hiddenArticles: Number(stats[0]?.hiddenArticles) || 0,
      totalViews: Number(stats[0]?.totalViews) || 0,
    };
  }
}
