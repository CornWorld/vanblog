import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database';
import { articles, tags } from '../../database/schema';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { safeParseJson, dataSchemas } from '../../shared/zod';
import { HookService } from '../plugin/services/hook.service';

import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  ArticleListResponseDto,
  ArticleSearchDto,
  ArticleSearchResponseDto,
} from './dto/article.dto';
import { Article } from './entities/article.entity';

import type { Database } from '../../database/connection';

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly hookService: HookService,
  ) {}

  async findAll(query: ArticleQueryDto): Promise<ArticleListResponseDto> {
    const {
      page = 1,
      pageSize = 10,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      category,
      tag,
      keyword,
      isPublished,
    } = query;

    // Build where clause
    const whereConditions = [];
    if (category) {
      whereConditions.push(eq(articles.category, String(category)));
    }
    if (tag) {
      const tagConditions = [like(articles.tags, `%"${String(tag)}"%`)];
      whereConditions.push(or(...tagConditions));
    }
    if (keyword && keyword !== '') {
      whereConditions.push(
        or(
          like(articles.title, `%${String(keyword)}%`),
          like(articles.content, `%${String(keyword)}%`),
        ),
      );
    }
    if (isPublished !== undefined) {
      whereConditions.push(eq(articles.hidden, !isPublished));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Build order by clause
    const orderByClause = (() => {
      const column = articles[sortBy as keyof typeof articles.$inferSelect];
      return sortOrder === 'asc' ? asc(column) : desc(column);
    })();

    const [articleResults, countResult] = await Promise.all([
      this.db
        .select()
        .from(articles)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(Number(pageSize))
        .offset((Number(page) - 1) * Number(pageSize)),
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
      tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
      category: article.category,
      author: article.author,
      top: article.top,
      hidden: article.hidden,
      private: article.private,
      password: article.password,
      viewer: article.viewer,
      createdAt: dayjs(article.createdAt),
      updatedAt: dayjs(article.updatedAt),
    }));

    const total = Number(countResult[0]?.count) > 0 ? Number(countResult[0]?.count) : 0;
    const totalPages = Math.ceil(total / Number(pageSize));

    return {
      items: processedArticles,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async search(query: ArticleSearchDto): Promise<ArticleSearchResponseDto> {
    const {
      keyword,
      page = 1,
      pageSize = 10,
      tags,
      category,
      includeHidden,
      titleOnly,
      contentOnly,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = query;

    return await this.queryOptimizer.withPerformanceMonitoring(
      'ArticleService.search',
      async () => {
        // Build where clause
        const whereConditions = [];

        if (category) {
          whereConditions.push(eq(articles.category, String(category)));
        }

        if (Array.isArray(tags) && tags.length > 0) {
          const tagConditions = tags.map((tag: string) =>
            like(articles.tags, `%"${String(tag)}"%`),
          );
          whereConditions.push(or(...tagConditions));
        }

        if (keyword !== '') {
          // 使用优化的搜索查询
          const searchInTitle = !contentOnly; // 默认搜索标题，除非明确指定只搜索内容
          const searchInContent = !titleOnly; // 默认搜索内容，除非明确指定只搜索标题

          const searchConditions = this.queryOptimizer.buildOptimizedSearchQuery(
            keyword,
            searchInTitle,
            searchInContent,
          );

          if (searchConditions.length > 0) {
            whereConditions.push(or(...searchConditions));
          }
        }

        if (!includeHidden) {
          whereConditions.push(eq(articles.hidden, false));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Build order by clause
        const orderByClause = (() => {
          const column = articles[sortBy as keyof typeof articles.$inferSelect];
          return sortOrder === 'asc' ? asc(column) : desc(column);
        })();

        const [articleResults, countResult] = await Promise.all([
          this.db
            .select()
            .from(articles)
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(Number(pageSize))
            .offset((Number(page) - 1) * Number(pageSize)),
          this.db
            .select({ count: sql<number>`count(*)` })
            .from(articles)
            .where(whereClause),
        ]);

        const processedArticles = articleResults.map((article) => ({
          id: article.id,
          title: article.title,
          summary: undefined,
          cover: undefined,
          tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
          categories: article.category ? [article.category] : [],
          publishedAt: article.updatedAt,
          highlight: undefined,
        }));

        const total = Number(countResult[0]?.count) > 0 ? Number(countResult[0]?.count) : 0;
        const totalPages = Math.ceil(total / Number(pageSize));

        return {
          items: processedArticles,
          total,
          page,
          pageSize,
          totalPages,
        };
      },
    );
  }

  async findOne(id: number): Promise<Article> {
    const articleResult = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);

    if (articleResult.length === 0) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    const [article] = articleResult;
    return new Article({
      ...article,
      tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
      pathname: article.pathname,
      category: article.category,
      author: article.author,
      top: article.top,
      hidden: article.hidden,
      private: article.private,
      password: article.password,
      viewer: article.viewer,
    });
  }

  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const { tags: tagNames, ...articleData } = createArticleDto;

    // Create missing tags
    if (Array.isArray(tagNames) && tagNames.length > 0) {
      await this.createMissingTags(tagNames);
    }

    let newArticleData = {
      title: String(articleData.title),
      content: String(articleData.content),
      pathname: articleData.pathname ? String(articleData.pathname) : undefined,
      category: articleData.category ? String(articleData.category) : undefined,
      author: articleData.author !== '' ? String(articleData.author) : 'admin',
      top: articleData.top ? Number(articleData.top) : undefined,
      hidden: articleData.hidden ? Boolean(articleData.hidden) : undefined,
      private: articleData.private ? Boolean(articleData.private) : undefined,
      password: articleData.password ? String(articleData.password) : undefined,
      viewer: 0,
      tags: JSON.stringify(Array.isArray(tagNames) ? tagNames : []),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    };

    // Process article data

    // Trigger article|beforeCreate hook (new hook system)
    try {
      newArticleData = await this.hookService.applyFilters('article|beforeCreate', newArticleData, {
        action: 'create',
      });
    } catch (error) {
      this.logger.error('Error in article|beforeCreate hook:', error);
    }

    const insertResult = await this.db.insert(articles).values([newArticleData]).returning();

    const [newArticle] = insertResult;
    const articleResult = new Article({
      ...newArticle,
      tags: safeParseJson(newArticle.tags, dataSchemas.tagsArray) ?? [],
      pathname: newArticle.pathname,
      category: newArticle.category,
      author: newArticle.author,
      top: newArticle.top,
      hidden: newArticle.hidden,
      private: newArticle.private,
      password: newArticle.password,
      viewer: newArticle.viewer,
    });

    // Article created successfully

    // Trigger article|afterCreate hook (new hook system)
    await this.hookService.doAction('article|afterCreate', articleResult, { action: 'create' });

    // Trigger webhook event
    await this.hookService.doAction('article.created', {
      id: articleResult.id,
      title: articleResult.title,
      author: articleResult.author,
      category: articleResult.category,
      tags: articleResult.tags,
      pathname: articleResult.pathname,
      createdAt: articleResult.createdAt,
    });

    return articleResult;
  }

  async update(id: number, updateArticleDto: UpdateArticleDto): Promise<Article> {
    // Verify article exists (will throw if not found)
    await this.findOne(id);

    const { tags: tagNames, ...articleData } = updateArticleDto;

    // Create missing tags
    if (Array.isArray(tagNames) && tagNames.length > 0) {
      await this.createMissingTags(tagNames);
    }

    let updateData = {
      ...Object.fromEntries(
        Object.entries(articleData).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : String(value),
        ]),
      ),
      ...(tagNames && { tags: JSON.stringify(tagNames) }),
      updatedAt: dayjs().toISOString(),
    };

    // Process update data

    // Trigger article|beforeUpdate hook (new hook system)
    try {
      updateData = await this.hookService.applyFilters('article|beforeUpdate', updateData, {
        action: 'update',
        id,
      });
    } catch (error) {
      this.logger.error('Error in article|beforeUpdate hook:', error);
    }

    const updateResult = await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    const [updatedArticle] = updateResult;
    const articleResult = new Article({
      ...updatedArticle,
      tags: safeParseJson(updatedArticle.tags, dataSchemas.tagsArray) ?? [],
      pathname: updatedArticle.pathname,
      category: updatedArticle.category,
      author: updatedArticle.author,
      top: updatedArticle.top,
      hidden: updatedArticle.hidden,
      private: updatedArticle.private,
      password: updatedArticle.password,
      viewer: updatedArticle.viewer,
    });

    // Article updated successfully

    // Trigger article|afterUpdate hook (new hook system)
    await this.hookService.doAction('article|afterUpdate', articleResult, {
      action: 'update',
      id,
    });

    // Trigger webhook event
    await this.hookService.doAction('article.updated', {
      id: articleResult.id,
      title: articleResult.title,
      author: articleResult.author,
      category: articleResult.category,
      tags: articleResult.tags,
      pathname: articleResult.pathname,
      updatedAt: articleResult.updatedAt,
    });

    return articleResult;
  }

  async remove(id: number): Promise<void> {
    // Check if article exists first
    const existingArticle = await this.db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    if (existingArticle.length === 0) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    // Prepare for deletion

    // Trigger article|beforeDelete hook (new hook system)
    await this.hookService.doAction('article|beforeDelete', { id }, { action: 'delete' });

    await this.db.delete(articles).where(eq(articles.id, id));

    // Trigger article|afterDelete hook (new hook system)
    await this.hookService.doAction('article|afterDelete', { id }, { action: 'delete' });

    // Trigger webhook event
    await this.hookService.doAction('article.deleted', { id });

    // Article deleted successfully
  }

  async exportArticles(): Promise<Article[]> {
    const articleResults = await this.db.select().from(articles);
    return articleResults.map(
      (article) =>
        new Article({
          id: article.id,
          title: article.title,
          content: article.content,
          pathname: article.pathname,
          tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
          category: article.category,
          author: article.author,
          top: article.top,
          hidden: article.hidden,
          private: article.private,
          password: article.password,
          viewer: article.viewer ?? 0,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        }),
    );
  }

  async importArticles(articleDtos: CreateArticleDto[]): Promise<void> {
    for (const articleDto of articleDtos) {
      await this.create(articleDto);
    }
  }

  async findByCategory(
    categoryName: string,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<ArticleListResponseDto> {
    const { page = 1, pageSize = 10 } = query;

    return await this.queryOptimizer.withPerformanceMonitoring(
      'ArticleService.findByCategory',
      async () => {
        const whereClause = eq(articles.category, String(categoryName));

        const [articleResults, countResult] = await Promise.all([
          this.db
            .select()
            .from(articles)
            .where(whereClause)
            .orderBy(desc(articles.updatedAt))
            .limit(Number(pageSize))
            .offset((Number(page) - 1) * Number(pageSize)),
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
          tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
          category: article.category,
          author: article.author,
          top: article.top,
          hidden: article.hidden,
          private: article.private,
          password: article.password,
          viewer: article.viewer,
          createdAt: dayjs(article.createdAt),
          updatedAt: dayjs(article.updatedAt),
        }));

        const total = Number(countResult[0]?.count) > 0 ? Number(countResult[0]?.count) : 0;
        const totalPages = Math.ceil(total / Number(pageSize));

        return {
          items: processedArticles,
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages,
        };
      },
    );
  }

  private async createMissingTags(tagNames: string[]): Promise<void> {
    const existingTags = await this.db
      .select({ name: tags.name })
      .from(tags)
      .where(or(...tagNames.map((name) => eq(tags.name, name))));

    const existingTagNames = existingTags.map((tag) => tag.name);
    const missingTagNames = tagNames.filter((name) => !existingTagNames.includes(name));

    if (missingTagNames.length > 0) {
      await this.db.insert(tags).values(
        missingTagNames.map((name) => ({
          name,
          createdAt: dayjs().toISOString(),
          updatedAt: dayjs().toISOString(),
        })),
      );
    }
  }
}
