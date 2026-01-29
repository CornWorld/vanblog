import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { tags, articles, articleTags } from '@vanblog/shared/drizzle';
import { eq, sql, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { ArticleListResponseSchema, ArticleQuerySchema } from '../article/dto/article.dto';
import { HookService } from '../plugin/services/hook.service';

import { CreateTagSchema, UpdateTagSchema, TagListResponseSchema } from './dto/tag.dto';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly statisticsService: StatisticsService,
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly hookService: HookService,
  ) {}

  /**
   * 获取所有标签
   *
   * 使用批量查询优化，避免 N+1 查询问题
   * 同时统计每个标签关联的文章数量
   *
   * @returns 标签列表和总数
   */
  async findAll(): Promise<z.infer<typeof TagListResponseSchema>> {
    return await this.queryOptimizer.withPerformanceMonitoring('TagService.findAll', async () => {
      const tagResults = await this.db.select().from(tags);
      const total = tagResults.length;

      if (total === 0) {
        return {
          items: [],
          total: 0,
        };
      }

      // 批量查询所有标签的文章数量，避免 N+1 查询问题
      const tagNames = tagResults.map((tag) => tag.name);
      const articleCounts = await this.queryOptimizer.batchCountArticlesByTags(this.db, tagNames);

      const processedTags = tagResults.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        articleCount: articleCounts[tag.name] ?? 0,
        createdAt: dayjs(tag.createdAt).format(),
      }));

      return {
        items: processedTags,
        total,
      };
    });
  }

  async findOne(id: number): Promise<Tag> {
    const results = await this.db.select().from(tags).where(eq(tags.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    const [result] = results;
    return new Tag({
      ...result,
      slug: result.slug ?? undefined,
      createdAt: dayjs(result.createdAt).format(),
      updatedAt: undefined,
    });
  }

  async create(createTagDto: z.infer<typeof CreateTagSchema>): Promise<Tag> {
    let tagData = createTagDto;

    // Trigger beforeCreate hook
    try {
      tagData = await this.hookService.applyFilters('tag|beforeCreate', tagData, {
        action: 'create',
      });
    } catch {
      // Hook errors should not break the main flow
    }

    const result = await this.db.insert(tags).values(tagData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create tag');
    }

    const tagResult = new Tag({
      ...result[0],
      slug: result[0].slug ?? undefined,
      createdAt: dayjs(result[0].createdAt).format(),
      updatedAt: undefined,
    });

    // Trigger webhook event
    await this.hookService.doAction('tag|afterCreate', tagResult, {
      id: tagResult.id,
      name: tagResult.name,
      slug: tagResult.slug,
      createdAt: tagResult.createdAt,
    });

    return tagResult;
  }

  async update(id: number, updateTagDto: z.infer<typeof UpdateTagSchema>): Promise<Tag> {
    let tagData = updateTagDto;

    // Trigger tag|before_update hook
    tagData = await this.hookService.applyFilters('tag|beforeUpdate', tagData, {
      action: 'update',
      id,
    });

    const result = await this.db.update(tags).set(tagData).where(eq(tags.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    const tagResult = new Tag({
      ...result[0],
      slug: result[0].slug ?? undefined,
      createdAt: dayjs(result[0].createdAt).format(),
      updatedAt: undefined,
    });

    // Trigger webhook event
    await this.hookService.doAction('tag|afterUpdate', tagResult, {
      id: tagResult.id,
      name: tagResult.name,
      slug: tagResult.slug,
      updatedAt: tagResult.updatedAt,
    });

    return tagResult;
  }

  async remove(id: number): Promise<void> {
    // Trigger tag|before_delete hook
    await this.hookService.doAction(
      'tag|beforeDelete',
      { id },
      {
        action: 'delete',
      },
    );

    const result = await this.db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });

    if (result.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    // Trigger webhook event
    await this.hookService.doAction('tag|afterDelete', { id });
  }

  async getStatistics(): Promise<OverallStatisticsDto> {
    return this.statisticsService.getOverallStatistics();
  }

  async findByName(name: string): Promise<Tag | null> {
    const results = await this.db.select().from(tags).where(eq(tags.name, name)).limit(1);

    if (results.length === 0) {
      return null;
    }

    const [result] = results;
    return new Tag({
      ...result,
      slug: result.slug ?? undefined,
      createdAt: dayjs(result.createdAt).format(),
      updatedAt: undefined,
    });
  }

  /**
   * 查找或创建标签
   *
   * 如果标签不存在则自动创建，确保标签系统的完整性
   *
   * @param tagNames 标签名称数组
   * @returns 标签实体数组（包含新创建和已存在的）
   */
  async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
    const existingTags = await this.db.select().from(tags);
    const existingTagNames = new Set(existingTags.map((tag) => tag.name));

    const missingTags = tagNames.filter((tagName) => !existingTagNames.has(tagName));

    if (missingTags.length > 0) {
      const tagsToCreate = missingTags.map((tagName) => ({
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
      }));

      await this.db.insert(tags).values(tagsToCreate);
    }

    const allTags = await this.db
      .select()
      .from(tags)
      .where(
        sql`${tags.name} IN (${sql.join(
          tagNames.map((name) => sql`${name}`),
          sql`, `,
        )})`,
      );

    return allTags.map(
      (tag) =>
        new Tag({
          ...tag,
          slug: tag.slug ?? undefined,
          createdAt: dayjs(tag.createdAt).format(),
          updatedAt: undefined,
        }),
    );
  }

  /**
   * 获取标签及其关联的分类统计
   *
   * 返回所有标签以及每个标签在不同分类中的使用情况
   *
   * @returns 标签和分类统计数据数组
   */
  async getTagsWithCategories(): Promise<
    {
      tag: Tag;
      categories: { name: string; count: number }[];
    }[]
  > {
    const tagList = await this.db.select().from(tags);

    // 并发查询每个标签的分类统计（使用 article_tags 关联表）
    const results = await Promise.all(
      tagList.map(async (tag) => {
        // 从 article_tags 关联表查询包含该标签的文章，并按分类分组统计
        const articleIdsWithTag = await this.db
          .select({ articleId: articleTags.articleId })
          .from(articleTags)
          .where(eq(articleTags.tagName, tag.name));

        if (articleIdsWithTag.length === 0) {
          return {
            tag: new Tag({
              ...tag,
              slug: tag.slug ?? undefined,
              createdAt: dayjs(tag.createdAt).format(),
              updatedAt: undefined,
            }),
            categories: [],
          };
        }

        const categoryStats = await this.db
          .select({
            category: articles.category,
            count: sql<number>`count(*)`,
          })
          .from(articles)
          .where(
            inArray(
              articles.id,
              articleIdsWithTag.map((a) => a.articleId),
            ),
          )
          .groupBy(articles.category);

        return {
          tag: new Tag({
            ...tag,
            slug: tag.slug ?? undefined,
            createdAt: dayjs(tag.createdAt).format(),
            updatedAt: undefined,
          }),
          categories: categoryStats
            .filter((stat) => stat.category !== null)
            .map((stat) => ({
              name: stat.category as string,
              count: stat.count,
            })),
        };
      }),
    );

    return results;
  }

  async getArticlesByTagId(
    id: number,
    query: z.infer<typeof ArticleQuerySchema>,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    // 首先验证标签是否存在
    const tag = await this.findOne(id);

    const { page = 1, pageSize = 10, includeHidden = false } = query;

    // 第一步：从 article_tags 关联表获取包含该标签的所有文章 ID
    const articleIdsWithTag = await this.db
      .select({ articleId: articleTags.articleId })
      .from(articleTags)
      .where(eq(articleTags.tagName, tag.name));

    if (articleIdsWithTag.length === 0) {
      // 没有文章包含此标签，返回空结果
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    // 构建查询条件
    const whereClause = and(
      inArray(
        articles.id,
        articleIdsWithTag.map((a) => a.articleId),
      ),
      includeHidden ? undefined : eq(articles.hidden, false),
    );

    // 构建排序条件
    const orderByClause = desc(articles.updatedAt);

    const p = page;
    const ps = pageSize;
    const [articleResults, countResult] = await Promise.all([
      this.db
        .select()
        .from(articles)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(ps)
        .offset((p - 1) * ps),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    const processedArticles = articleResults.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      pathname: article.pathname,
      tags: article.tags ?? [],
      category: article.category,
      author: article.author,
      top: article.top,
      hidden: article.hidden,
      private: article.private,
      password: article.password,
      viewer: article.viewer,
      createdAt: dayjs(article.createdAt).format(),
      updatedAt: dayjs(article.updatedAt).format(),
    }));

    const totalRaw = countResult[0]?.count ?? 0;
    const total = totalRaw > 0 ? totalRaw : 0;
    const totalPages = Math.ceil(total / ps);

    return {
      items: processedArticles,
      total,
      page: p,
      pageSize: ps,
      totalPages,
    };
  }
}
