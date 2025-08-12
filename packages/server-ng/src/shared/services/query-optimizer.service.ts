import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import type { Database } from '../../database/connection';

/**
 * 查询优化服务
 * 提供数据库查询性能优化的工具和方法
 */
@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);

  /**
   * 批量查询标签的文章数量，避免 N+1 查询问题
   * @param db 数据库连接
   * @param tagNames 标签名称数组
   * @returns 标签名称到文章数量的映射
   */
  async batchCountArticlesByTags(
    db: Database,
    tagNames: string[],
  ): Promise<Record<string, number>> {
    if (tagNames.length === 0) {
      return {};
    }

    try {
      // 使用 SQL 子查询批量统计每个标签的文章数量
      const tagCountQuery = sql`
        SELECT
          tag_name,
          COUNT(*) as article_count
        FROM (
          SELECT
            json_extract(value, '$') as tag_name
          FROM
            articles,
            json_each(articles.tags)
          WHERE
            json_extract(value, '$') IN (${sql.join(
              tagNames.map((name) => sql`${name}`),
              sql`, `,
            )})
            AND articles.hidden = 0
        ) tag_articles
        GROUP BY tag_name
      `;

      const results = await db.all(tagCountQuery);

      // 转换为 Record 格式
      const countMap: Record<string, number> = {};

      // 初始化所有标签计数为 0
      for (const tagName of tagNames) {
        countMap[tagName] = 0;
      }

      // 填充实际计数
      for (const result of results as Array<{ tag_name: string; article_count: number }>) {
        countMap[result.tag_name] = result.article_count;
      }

      return countMap;
    } catch (error) {
      this.logger.error('Error in batchCountArticlesByTags:', error);
      // 降级到单个查询
      return this.fallbackCountArticlesByTags(db, tagNames);
    }
  }

  /**
   * 降级方案：单个查询标签文章数量
   */
  private async fallbackCountArticlesByTags(
    db: Database,
    tagNames: string[],
  ): Promise<Record<string, number>> {
    const countMap: Record<string, number> = {};

    for (const tagName of tagNames) {
      try {
        const countQuery = sql`
          SELECT COUNT(*) as count
          FROM articles
          WHERE json_extract(tags, '$') LIKE '%' || ${tagName} || '%'
            AND hidden = 0
        `;

        const result: { count: number } | undefined = await db.get(countQuery);
        countMap[tagName] = result?.count ?? 0;
      } catch (error: unknown) {
        this.logger.warn(`Failed to count articles for tag ${tagName}:`, error);
        countMap[tagName] = 0;
      }
    }

    return countMap;
  }

  /**
   * 批量查询分类的文章数量
   * @param db 数据库连接
   * @param categoryNames 分类名称数组
   * @returns 分类名称到文章数量的映射
   */
  async batchCountArticlesByCategories(
    db: Database,
    categoryNames: string[],
  ): Promise<Record<string, number>> {
    if (categoryNames.length === 0) {
      return {};
    }

    try {
      const categoryCountQuery = sql`
        SELECT
          category,
          COUNT(*) as article_count
        FROM articles
        WHERE
          category IN (${sql.join(
            categoryNames.map((name) => sql`${name}`),
            sql`, `,
          )})
          AND hidden = 0
        GROUP BY category
      `;

      const results = await db.all(categoryCountQuery);

      const countMap: Record<string, number> = {};

      // 初始化所有分类计数为 0
      for (const categoryName of categoryNames) {
        countMap[categoryName] = 0;
      }

      // 填充实际计数
      for (const result of results as Array<{ category: string; article_count: number }>) {
        countMap[result.category] = result.article_count;
      }

      return countMap;
    } catch (error) {
      this.logger.error('Error in batchCountArticlesByCategories:', error);

      // 降级方案
      const countMap: Record<string, number> = {};
      for (const categoryName of categoryNames) {
        countMap[categoryName] = 0;
      }
      return countMap;
    }
  }

  /**
   * 优化的文章搜索查询
   * 使用全文搜索索引（如果可用）或优化的 LIKE 查询
   */
  buildOptimizedSearchQuery(
    keyword: string,
    searchInTitle: boolean,
    searchInContent: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any[] {
    const conditions = [];

    if (searchInTitle) {
      // 对于标题搜索，使用索引友好的查询
      conditions.push(sql`title LIKE ${`%${keyword}%`}`);
    }

    if (searchInContent) {
      // 对于内容搜索，考虑使用 FTS 或限制搜索长度
      if (keyword.length <= 50) {
        conditions.push(sql`content LIKE ${`%${keyword}%`}`);
      } else {
        // 对于长关键词，只搜索前50个字符
        const shortKeyword = keyword.substring(0, 50);
        conditions.push(sql`content LIKE ${`%${shortKeyword}%`}`);
      }
    }

    return conditions;
  }

  /**
   * 记录慢查询
   * @param queryName 查询名称
   * @param duration 执行时间（毫秒）
   * @param threshold 慢查询阈值（毫秒）
   */
  logSlowQuery(queryName: string, duration: number, threshold = 1000): void {
    if (duration > threshold) {
      this.logger.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }
  }

  /**
   * 查询性能监控装饰器
   */
  async withPerformanceMonitoring<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    threshold = 1000,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      this.logSlowQuery(queryName, duration, threshold);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Query ${queryName} failed after ${duration}ms:`, error);
      throw error;
    }
  }
}
