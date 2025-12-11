import { Injectable, Inject } from '@nestjs/common';
import { categories, tags, articles } from '@vanblog/shared/drizzle';
import { eq, sql, like, and } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import {
  CategoryStatisticsDto,
  TagStatisticsDto,
  OverallStatisticsDto,
} from '../dto/statistics.dto';

/**
 * 统计数据服务
 *
 * 提供系统各种统计数据的计算和查询功能，包括文章、分类、标签等
 * 的统计信息。用于生成仪表板数据和分析报告。
 */
@Injectable()
export class StatisticsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  /**
   * 获取系统整体统计信息
   *
   * 汇总系统中所有模块的统计数据，包括文章、分类、标签的数量
   * 和状态分布，以及总浏览量等关键指标。
   *
   * @returns 系统整体统计数据
   */
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

  /**
   * 获取分类统计信息
   *
   * 计算每个分类下的文章数量、浏览量等统计数据。
   *
   * @returns 分类统计数据列表
   * @private
   */
  private async getCategoryStatistics(): Promise<CategoryStatisticsDto[]> {
    const allCategories = await this.db.select().from(categories);

    const categoryStats = await Promise.all(
      allCategories.map(async (category) => {
        const [result] = await this.db
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
          articleCount: Math.max(0, result.articleCount),
          publishedCount: Math.max(0, result.publishedCount),
          privateCount: Math.max(0, result.privateCount),
          totalViews: Math.max(0, result.totalViews),
        };
      }),
    );

    return categoryStats;
  }

  /**
   * 获取标签统计信息
   *
   * 计算每个标签下的文章数量、浏览量等统计数据。
   *
   * @returns 标签统计数据列表
   * @private
   */
  private async getTagStatistics(): Promise<TagStatisticsDto[]> {
    const allTags = await this.db.select().from(tags);

    const tagStats = await Promise.all(
      allTags.map(async (tag) => {
        const [result] = await this.db
          .select({
            articleCount: sql<number>`count(*)`,
            totalViews: sql<number>`sum(viewer)`,
          })
          .from(articles)
          .where(like(articles.tags, `"%${tag.name}%"`.replace('"%', '%"').replace('%"', '"%')));

        return {
          id: tag.id,
          name: tag.name,
          slug: tag.slug ?? undefined,
          articleCount: Math.max(0, result.articleCount),
          totalViews: Math.max(0, result.totalViews),
        };
      }),
    );

    return tagStats;
  }

  /**
   * 获取文章统计信息
   *
   * 计算文章的总数、已发布数量、私有数量、隐藏数量和总浏览量。
   *
   * @returns 文章统计数据对象
   * @private
   */
  private async getArticleStatistics(): Promise<{
    totalArticles: number;
    publishedArticles: number;
    privateArticles: number;
    hiddenArticles: number;
    totalViews: number;
  }> {
    const [result] = await this.db
      .select({
        totalArticles: sql<number>`count(*)`,
        publishedArticles: sql<number>`count(case when hidden = false and private = false then 1 end)`,
        privateArticles: sql<number>`count(case when private = true then 1 end)`,
        hiddenArticles: sql<number>`count(case when hidden = true then 1 end)`,
        totalViews: sql<number>`sum(viewer)`,
      })
      .from(articles);

    return {
      totalArticles: Math.max(0, result.totalArticles),
      publishedArticles: Math.max(0, result.publishedArticles),
      privateArticles: Math.max(0, result.privateArticles),
      hiddenArticles: Math.max(0, result.hiddenArticles),
      totalViews: Math.max(0, result.totalViews),
    };
  }

  /**
   * 获取已发布文章的总字数
   *
   * 计算所有已发布文章的内容字数总和，用于统计创作量。
   *
   * @returns 已发布文章的总字数
   */
  async getTotalPublishedWordCount(): Promise<number> {
    // 基于 SQLite 的 length() 统计字符数，保持与 Draft.wordCount 一致（以字符数为度量）
    const res = await this.db
      .select({ total: sql<number>`sum(length(${articles.content}))` })
      .from(articles)
      .where(and(eq(articles.hidden, false), eq(articles.private, false)));

    const total = res[0]?.total ?? 0;
    return Number.isFinite(total) && total > 0 ? total : 0;
  }
}
