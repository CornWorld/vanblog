import { Injectable, Logger } from '@nestjs/common';
import { articles } from '@vanblog/shared/drizzle';
import { sql, type SQL, like, or } from 'drizzle-orm';

import type { Database } from '../../database';

/**
 * 查询优化服务
 *
 * 提供简单的查询优化功能，专注于实际需要的功能。
 */
@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);

  /**
   * 批量计算标签的文章数量
   */
  async batchCountArticlesByTags(
    db: Database,
    tagNames: string[],
  ): Promise<Record<string, number>> {
    if (tagNames.length === 0) {
      return {};
    }

    try {
      // 使用 JSON 查询批量统计每个标签的文章数量
      const tagCountQuery = sql`
        SELECT
          tag_name,
          COUNT(*) as article_count
        FROM (
          SELECT
            value as tag_name
          FROM
            articles,
            json_each(CASE WHEN json_valid(articles.tags) THEN articles.tags ELSE '[]' END)
          WHERE
            value IN (${sql.join(
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
      for (const result of results) {
        const row = result as { tag_name: string; article_count: number };
        countMap[row.tag_name] = row.article_count;
      }

      return countMap;
    } catch (error) {
      this.logger.error('Failed to batch count articles by tags:', error);
      return {};
    }
  }

  /**
   * 构建优化的搜索查询条件
   */
  buildOptimizedSearchQuery(
    keyword: string,
    searchInTitle: boolean,
    searchInContent: boolean,
  ): SQL[] {
    const conditions: SQL[] = [];
    const searchTerm = `%${keyword}%`;

    if (searchInTitle) {
      conditions.push(like(articles.title, searchTerm));
    }

    if (searchInContent) {
      conditions.push(like(articles.content, searchTerm));
    }

    if (conditions.length === 0) {
      return [];
    }

    const orCondition = or(...conditions);
    return orCondition ? [orCondition] : [];
  }

  /**
   * 性能监控包装器
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

      if (duration > threshold) {
        this.logger.warn(`Slow query detected: ${queryName} took ${String(duration)}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Query failed: ${queryName} after ${String(duration)}ms`, error);
      throw error;
    }
  }
}
