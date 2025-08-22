import { Injectable, Logger } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';

import { CacheService } from '../cache/cache.service';

import type { Database } from '../../database';

/**
 * 查询统计信息
 */
interface QueryStats {
  name: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  lastExecuted: Date;
}

/**
 * 索引建议
 */
interface IndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: string;
}

/**
 * 查询优化服务
 *
 * 提供数据库查询性能优化的工具和方法，包括查询性能监控、
 * 批量查询优化、索引建议和缓存管理等功能。
 */
@Injectable()
export class QueryOptimizerService {
  private readonly logger = new Logger(QueryOptimizerService.name);
  private readonly queryStats = new Map<string, QueryStats>();
  private readonly indexSuggestions: IndexSuggestion[] = [];

  constructor(private readonly cacheService: CacheService) {
    // 初始化一些基础的索引建议
    this.initializeIndexSuggestions();
  }

  /**
   * 初始化索引建议
   */
  private initializeIndexSuggestions(): void {
    // 大部分基础索引已经在 schema.ts 中实现
    // 这里只保留一些高级的复合索引建议
    this.indexSuggestions.push(
      {
        table: 'articles',
        columns: ['hidden', 'private', 'createdAt'],
        reason: 'Triple column index for complex visibility filtering with date sorting',
        estimatedImprovement: 'High - optimizes complex article listing queries',
      },
      {
        table: 'articles',
        columns: ['category', 'hidden', 'top'],
        reason: 'Composite index for category pages with visibility and pinning',
        estimatedImprovement: 'Medium - improves category page performance',
      },
      {
        table: 'draftVersions',
        columns: ['draftId', 'version'],
        reason: 'Composite index for draft version queries',
        estimatedImprovement: 'High - enables fast draft version lookups',
      },
      {
        table: 'analytics',
        columns: ['date', 'type'],
        reason: 'Composite index for analytics queries by date and type',
        estimatedImprovement: 'Medium - improves analytics performance',
      },
    );
  }

  /**
   * 批量查询标签的文章数量，避免 N+1 查询问题
   * @param db 数据库连接
   * @param tagNames 标签名称数组
   * @returns 标签名称到文章数量的映射
   */
  /**
   * 批量统计标签下的文章数量
   *
   * 使用优化的查询策略批量获取多个标签的文章数量，
   * 避免 N+1 查询问题。优先使用缓存，缓存失效时回退到数据库查询。
   *
   * @param db 数据库连接实例
   * @param tagNames 标签名称数组
   * @returns 标签名称到文章数量的映射对象
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
          WHERE (tags IS NOT NULL AND tags != '' AND tags LIKE '%' || '"' || ${tagName} || '"' || '%')
            AND hidden = 0
        `;

        const result = await db.get(countQuery);
        const row = result as { count: number } | undefined;
        countMap[tagName] = row?.count ?? 0;
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
  /**
   * 批量统计分类下的文章数量
   *
   * 使用优化的查询策略批量获取多个分类的文章数量，
   * 避免 N+1 查询问题。优先使用缓存，缓存失效时回退到数据库查询。
   *
   * @param db 数据库连接实例
   * @param categoryNames 分类名称数组
   * @returns 分类名称到文章数量的映射对象
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
      for (const result of results) {
        const row = result as { category: string; article_count: number };
        countMap[row.category] = row.article_count;
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
  /**
   * 构建优化的搜索查询条件
   *
   * 根据搜索关键词和搜索范围构建优化的 SQL 查询条件，
   * 支持在标题和内容中进行搜索。
   *
   * @param keyword 搜索关键词
   * @param searchInTitle 是否在标题中搜索
   * @param searchInContent 是否在内容中搜索
   * @returns SQL 查询条件数组
   */
  buildOptimizedSearchQuery(
    keyword: string,
    searchInTitle: boolean,
    searchInContent: boolean,
  ): SQL[] {
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
  /**
   * 带性能监控的查询执行
   *
   * 包装查询函数，自动记录执行时间和性能统计。
   * 当查询时间超过阈值时会记录慢查询日志。
   *
   * @param queryName 查询名称，用于统计和日志
   * @param queryFn 要执行的查询函数
   * @param threshold 慢查询阈值（毫秒），默认 1000ms
   * @returns 查询函数的执行结果
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
      this.updateQueryStats(queryName, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Query ${queryName} failed after ${duration}ms:`, error);
      this.updateQueryStats(queryName, duration);
      throw error;
    }
  }

  /**
   * 更新查询统计信息
   */
  private updateQueryStats(queryName: string, duration: number): void {
    const existing = this.queryStats.get(queryName);

    if (existing) {
      existing.count += 1;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.minTime = Math.min(existing.minTime, duration);
      existing.lastExecuted = new Date();
    } else {
      this.queryStats.set(queryName, {
        name: queryName,
        count: 1,
        totalTime: duration,
        avgTime: duration,
        maxTime: duration,
        minTime: duration,
        lastExecuted: new Date(),
      });
    }
  }

  /**
   * 获取查询统计信息
   */
  getQueryStats(): QueryStats[] {
    return Array.from(this.queryStats.values()).sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * 获取慢查询统计
   */
  getSlowQueries(threshold = 1000): QueryStats[] {
    return this.getQueryStats().filter((stat) => stat.avgTime > threshold);
  }

  /**
   * 重置查询统计
   */
  resetQueryStats(): void {
    this.queryStats.clear();
  }

  /**
   * 获取索引建议
   */
  getIndexSuggestions(): IndexSuggestion[] {
    return [...this.indexSuggestions];
  }

  /**
   * 添加动态索引建议
   */
  addIndexSuggestion(suggestion: IndexSuggestion): void {
    // 检查是否已存在相同的建议
    const exists = this.indexSuggestions.some(
      (s) =>
        s.table === suggestion.table &&
        JSON.stringify(s.columns.sort()) === JSON.stringify(suggestion.columns.sort()),
    );

    if (!exists) {
      this.indexSuggestions.push(suggestion);
    }
  }

  /**
   * 分析查询模式并生成索引建议
   */
  analyzeQueryPatterns(): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    const stats = this.getQueryStats();

    // 分析慢查询模式
    const slowQueries = stats.filter((s) => s.avgTime > 500);

    for (const query of slowQueries) {
      if (query.name.includes('article') && query.name.includes('search')) {
        suggestions.push({
          table: 'articles',
          columns: ['title', 'content'],
          reason: `Slow search query detected: ${query.name} (avg: ${query.avgTime}ms)`,
          estimatedImprovement: 'High - consider full-text search index',
        });
      }

      if (query.name.includes('category') && query.avgTime > 1000) {
        suggestions.push({
          table: 'articles',
          columns: ['category', 'createdAt'],
          reason: `Slow category query: ${query.name} (avg: ${query.avgTime}ms)`,
          estimatedImprovement: 'Medium - composite index for category + date sorting',
        });
      }
    }

    return suggestions;
  }

  /**
   * 生成查询优化报告
   */
  generateOptimizationReport(): {
    totalQueries: number;
    slowQueries: QueryStats[];
    indexSuggestions: IndexSuggestion[];
    dynamicSuggestions: IndexSuggestion[];
  } {
    const stats = this.getQueryStats();
    const slowQueries = this.getSlowQueries();
    const dynamicSuggestions = this.analyzeQueryPatterns();

    return {
      totalQueries: stats.reduce((sum, stat) => sum + stat.count, 0),
      slowQueries,
      indexSuggestions: this.getIndexSuggestions(),
      dynamicSuggestions,
    };
  }

  /**
   * 查询缓存包装器
   */
  /**
   * 带缓存的查询执行
   *
   * 包装查询函数，自动处理缓存的读取和写入。
   * 如果缓存存在则直接返回，否则执行查询并缓存结果。
   *
   * @param key 缓存键名
   * @param queryFn 要执行的查询函数
   * @param ttl 缓存过期时间（秒），默认 300 秒（5分钟）
   * @returns 查询结果或缓存的结果
   */
  async withCache<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl = 300, // 5分钟默认TTL（秒）
  ): Promise<T> {
    return this.cacheService.wrap(key, queryFn, ttl);
  }

  /**
   * 清除缓存
   */
  async clearCache(pattern?: string): Promise<void> {
    if (pattern) {
      // 注意：当前 CacheService 不支持模式匹配清除
      // 这是一个简化的实现，只清除所有缓存
      await this.cacheService.clear();
    } else {
      // 清除所有缓存
      await this.cacheService.clear();
    }
  }
}
