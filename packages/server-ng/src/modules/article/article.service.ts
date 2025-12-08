import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import * as bcrypt from 'bcrypt';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';

import { ConfigService } from '../../config/config.service';
import { DATABASE_CONNECTION, type Database } from '../../database';
import { articles, tags } from '@vanblog/shared/drizzle';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { safeParseJson, dataSchemas } from '@vanblog/shared/drizzle';
import { HookService } from '../plugin/services/hook.service';

import {
  CreateArticleSchema,
  UpdateArticleSchema,
  ArticleQuerySchema,
  ArticleListResponseSchema,
  ArticleSearchSchema,
  ArticleSearchResponseSchema,
} from './dto/article.dto';
import { ArticleAccessResponseSchema } from './dto/verify-password.dto';
import { Article } from './entities/article.entity';

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly hookService: HookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 派生文章发布时间
   *
   * 当前规则：优先使用 updatedAt，失败时回退到 createdAt
   *
   * @param createdAt 创建时间
   * @param updatedAt 更新时间
   * @returns 格式化的发布时间字符串
   */
  private derivePubTime(createdAt: string | Date, updatedAt: string | Date): string {
    try {
      const base = updatedAt;
      return dayjs(base).format();
    } catch (_e) {
      this.logger.warn('派生 pubTime 失败，使用 createdAt 作为回退值');
      const fallback = typeof createdAt === 'string' && createdAt !== '' ? createdAt : new Date();
      return dayjs(fallback).format();
    }
  }

  /**
   * 查询文章列表
   *
   * 支持分页、排序、分类筛选、标签筛选、关键词搜索等功能
   *
   * @param query 查询参数
   * @returns 文章列表和分页信息
   */
  async findAll(
    query: z.infer<typeof ArticleQuerySchema>,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const {
      page = 1,
      pageSize = 10,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      category,
      tag,
      keyword,
      isPublished,
      includeHidden,
    } = query;

    // 构建查询条件
    const whereConditions = [];
    if (category) {
      whereConditions.push(eq(articles.category, category));
    }
    if (tag) {
      // 标签存储为 JSON 数组，使用 LIKE 匹配
      const tagConditions = [like(articles.tags, `"%"${tag}"%"`)];
      whereConditions.push(or(...tagConditions));
    }
    if (keyword && keyword !== '') {
      whereConditions.push(
        or(like(articles.title, `%${keyword}%`), like(articles.content, `%${keyword}%`)),
      );
    }

    // 过滤隐藏文章（除非显式包含）
    if (!includeHidden) {
      whereConditions.push(eq(articles.hidden, false));
    } else if (isPublished !== undefined) {
      whereConditions.push(eq(articles.hidden, !isPublished));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 构建排序条件
    const orderByClause = (() => {
      const column = articles[sortBy as keyof typeof articles.$inferSelect];
      return sortOrder === 'asc' ? asc(column) : desc(column);
    })();

    // 并发执行查询和计数，提高性能
    const [articleResults, countResult] = await Promise.all([
      this.db
        .select()
        .from(articles)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    // 处理文章数据：解析 JSON 字段，格式化日期
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
      createdAt: dayjs(article.createdAt).format(),
      updatedAt: dayjs(article.updatedAt).format(),
      pubTime: this.derivePubTime(article.createdAt, article.updatedAt),
    }));

    const total = (countResult[0]?.count ?? 0) > 0 ? (countResult[0]?.count ?? 0) : 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: processedArticles,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * 搜索文章
   *
   * 提供高级搜索功能，支持标题/内容搜索、分类和标签筛选、排序等
   * 使用查询优化器进行性能监控
   *
   * @param query 搜索参数
   * @returns 搜索结果和分页信息
   */
  async search(
    query: z.infer<typeof ArticleSearchSchema>,
  ): Promise<z.infer<typeof ArticleSearchResponseSchema>> {
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
        // 构建搜索条件
        const whereConditions = [];

        if (category) {
          whereConditions.push(eq(articles.category, category));
        }

        if (Array.isArray(tags) && tags.length > 0) {
          // 标签存储为 JSON 数组，使用 LIKE 匹配多个标签
          const tagConditions = tags.map((tag: string) => like(articles.tags, `"%"${tag}"%"`));
          whereConditions.push(or(...tagConditions));
        }

        if (keyword !== '') {
          // 使用优化的搜索查询，支持仅搜索标题或仅搜索内容
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

        // 构建动态排序条件
        const orderByClause = (() => {
          const validColumns = ['id', 'title', 'createdAt', 'updatedAt', 'category'] as const;
          type ValidColumn = (typeof validColumns)[number];
          const columnName: ValidColumn = validColumns.includes(sortBy as ValidColumn)
            ? (sortBy as ValidColumn)
            : 'createdAt';

          switch (columnName) {
            case 'id':
              return sortOrder === 'asc' ? asc(articles.id) : desc(articles.id);
            case 'title':
              return sortOrder === 'asc' ? asc(articles.title) : desc(articles.title);
            case 'createdAt':
              return sortOrder === 'asc' ? asc(articles.createdAt) : desc(articles.createdAt);
            case 'updatedAt':
              return sortOrder === 'asc' ? asc(articles.updatedAt) : desc(articles.updatedAt);
            case 'category':
              return sortOrder === 'asc' ? asc(articles.category) : desc(articles.category);
            default:
              return sortOrder === 'asc' ? asc(articles.createdAt) : desc(articles.createdAt);
          }
        })();

        const [articleResults, countResult] = await Promise.all([
          this.db
            .select()
            .from(articles)
            .where(whereClause)
            .orderBy(orderByClause)
            .limit(pageSize)
            .offset((page - 1) * pageSize),
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
          publishedAt: dayjs(article.updatedAt).format(),
          highlight: undefined,
        }));

        const total = (countResult[0]?.count ?? 0) > 0 ? (countResult[0]?.count ?? 0) : 0;
        const totalPages = Math.ceil(total / pageSize);

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

  /**
   * 验证文章密码
   *
   * 验证私有文章的访问密码，验证成功后发放短期访问令牌。
   * 令牌会绑定当前用户（如果已登录），未登录用户使用匿名访问令牌。
   *
   * @param id 文章 ID
   * @param password 用户输入的密码
   * @param userId 当前用户 ID（可选，来自认证上下文）
   * @returns 验证结果和访问令牌
   * @throws {NotFoundException} 当文章不存在时
   */
  private async verifyArticlePasswordCore(
    article: Article,
    password: string,
    userId?: number,
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    // 如果文章不是私有的或没有设置密码，直接允许访问
    if (!article.private || !article.password) {
      return {
        success: true,
        message: 'Article is not private',
      };
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, article.password);

    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid password',
      };
    }

    // 生成访问令牌（24小时有效期）
    // 如果用户已登录，绑定用户 ID；否则使用匿名访问
    const expiresAt = dayjs().add(24, 'hour').format();
    const tokenPayload = {
      articleId: article.id,
      articleTitle: article.title,
      pathname: article.pathname,
      type: 'article-access',
      userId: userId ?? null, // 绑定用户 ID，未登录则为 null
      isAnonymous: !userId, // 标记是否为匿名访问
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(tokenPayload, this.configService.jwt.secret, {
      expiresIn: '24h',
    });

    return {
      success: true,
      token,
      message: userId
        ? 'Access granted for authenticated user'
        : 'Access granted for anonymous user',
      expiresAt,
    };
  }

  async verifyPassword(
    id: number,
    password: string,
    userId?: number,
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    const article = await this.findOneWithPassword(id);
    return this.verifyArticlePasswordCore(article, password, userId);
  }

  async verifyPasswordByPathname(
    pathname: string,
    password: string,
    userId?: number,
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    const article = await this.findOneByPathname(pathname);
    return this.verifyArticlePasswordCore(article, password, userId);
  }

  /**
   * 获取文章的安全版本（不包含敏感信息）
   *
   * 对于私有文章，不返回密码字段，确保敏感信息不会泄露。
   *
   * @param id 文章 ID
   * @returns 文章实体（安全版本）
   * @throws {NotFoundException} 当文章不存在时
   */
  async findOne(id: number): Promise<Article> {
    const articleResult = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);

    if (articleResult.length === 0) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    const [article] = articleResult;
    return new Article({
      ...article,
      // 不返回密码字段，确保安全
      password: undefined,
      tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
      pathname: article.pathname,
      category: article.category,
      author: article.author,
      top: article.top,
      hidden: article.hidden,
      private: article.private,
      viewer: article.viewer,
    });
  }

  async findOneByPathname(pathname: string): Promise<Article> {
    const articleResult = await this.db
      .select()
      .from(articles)
      .where(eq(articles.pathname, pathname))
      .limit(1);

    if (articleResult.length === 0) {
      throw new NotFoundException(`Article with pathname ${pathname} not found`);
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

  /**
   * 判断指定 ID 的文章是否为私有
   * 返回 true/false；当文章不存在时返回 null
   */
  async isPrivateById(id: number): Promise<boolean | null> {
    const rows = await this.db
      .select({ private: articles.private })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    return Boolean(rows[0].private);
  }

  /**
   * 判断指定 pathname 的文章是否为私有
   * 返回 true/false；当文章不存在时返回 null
   */
  async isPrivateByPathname(pathname: string): Promise<boolean | null> {
    const rows = await this.db
      .select({ private: articles.private })
      .from(articles)
      .where(eq(articles.pathname, pathname))
      .limit(1);
    if (rows.length === 0) return null;
    return Boolean(rows[0].private);
  }

  async create(createArticleDto: z.infer<typeof CreateArticleSchema>): Promise<Article> {
    const { tags: tagNames, ...articleData } = createArticleDto;

    // Create missing tags
    if (Array.isArray(tagNames) && tagNames.length > 0) {
      await this.createMissingTags(tagNames);
    }

    let newArticleData = {
      title: articleData.title,
      content: articleData.content,
      pathname: articleData.pathname ?? undefined,
      category: articleData.category ?? undefined,
      author: articleData.author !== '' ? articleData.author : 'admin',
      top: articleData.top ?? undefined,
      hidden: articleData.hidden ?? undefined,
      private: articleData.private ?? undefined,
      password: articleData.password ?? undefined,
      viewer: 0,
      tags: JSON.stringify(Array.isArray(tagNames) ? tagNames : []),
      createdAt: dayjs().format(),
      updatedAt: dayjs().format(),
    };

    // 触发创建前的插件钩子，允许插件修改文章数据
    try {
      // Trigger article|beforeCreate hook (new hook system)
      newArticleData = await this.hookService.applyFilters('article|beforeCreate', newArticleData, {
        action: 'create',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in article|beforeCreate hook: ${msg}`);
    }

    // 密码加密（在钩子处理之后）
    if (newArticleData.password) {
      newArticleData.password = await bcrypt.hash(newArticleData.password, 10);
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

    // 触发创建后的插件钩子，通知插件文章已创建
    await this.hookService.doAction('article|afterCreate', articleResult, { action: 'create' });

    return articleResult;
  }

  async update(
    id: number,
    updateArticleDto: z.infer<typeof UpdateArticleSchema>,
  ): Promise<Article> {
    // Verify article exists (will throw if not found)
    await this.findOne(id);

    const { tags: tagNames, ...articleData } = updateArticleDto;

    // Create missing tags - tagNames is already transformed to JSON string by schema
    // Parse it back to array if needed for tag creation
    if (typeof tagNames === 'string' && tagNames !== '[]' && tagNames !== 'null') {
      try {
        const parsedTags = JSON.parse(tagNames) as string[];
        if (Array.isArray(parsedTags) && parsedTags.length > 0) {
          await this.createMissingTags(parsedTags);
        }
      } catch {
        // Ignore parse errors
      }
    }

    let updateData: Record<string, unknown> = {
      ...Object.fromEntries(
        Object.entries(articleData).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : value,
        ]),
      ),
      updatedAt: dayjs().format(),
    };

    // tagNames is string | null after schema transform
    if (typeof tagNames === 'string') {
      updateData.tags = tagNames;
    }

    // 触发更新前的插件钩子，允许插件修改更新数据
    try {
      // Trigger article|beforeUpdate hook (new hook system)
      updateData = await this.hookService.applyFilters('article|beforeUpdate', updateData, {
        id,
        action: 'update',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error in article|beforeUpdate hook: ${msg}`);
    }

    // 密码加密（在钩子处理之后）
    const pwd = updateData.password;
    if (typeof pwd === 'string' && pwd.length > 0) {
      updateData.password = await bcrypt.hash(pwd, 10);
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

    // 触发更新后的插件钩子，通知插件文章已更新
    await this.hookService.doAction('article|afterUpdate', articleResult, {
      action: 'update',
      id,
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
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    // 触发删除前的插件钩子，允许插件执行清理操作
    await this.hookService.doAction('article|beforeDelete', { id }, { action: 'delete' });

    await this.db.delete(articles).where(eq(articles.id, id));

    // 触发删除后的插件钩子，通知插件文章已删除
    await this.hookService.doAction('article|afterDelete', { id }, { action: 'delete' });
  }

  async exportArticles(): Promise<Article[]> {
    const articleResults = await this.db.select().from(articles);

    return articleResults.map(
      (article) =>
        new Article({
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
        }),
    );
  }

  async importArticles(articleDtos: Array<z.infer<typeof CreateArticleSchema>>): Promise<void> {
    for (const articleDto of articleDtos) {
      await this.create(articleDto);
    }
  }

  async findByCategory(
    categoryName: string,
    query: { page?: number; pageSize?: number; includeHidden?: boolean } = {},
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const { page = 1, pageSize = 10, includeHidden: _includeHidden = false } = query;

    const whereClause = and(eq(articles.category, categoryName));

    // Build order by clause (default by updatedAt desc)
    const orderByClause = desc(articles.updatedAt);

    const [articleResults, countResult] = await Promise.all([
      this.db
        .select()
        .from(articles)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
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
      createdAt: dayjs(article.createdAt).format(),
      updatedAt: dayjs(article.updatedAt).format(),
      pubTime: this.derivePubTime(article.createdAt, article.updatedAt),
    }));

    const total = (countResult[0]?.count ?? 0) > 0 ? (countResult[0]?.count ?? 0) : 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: processedArticles,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * 自动创建缺失的标签
   *
   * 在创建或更新文章时，自动创建数据库中不存在的标签
   * 避免因标签不存在导致的关联错误
   *
   * @param tagNames 标签名称数组
   */
  private async createMissingTags(tagNames: string[]): Promise<void> {
    // 获取现有标签
    const existingTags = await this.db.select().from(tags);
    const existingTagNames = new Set(existingTags.map((tag) => tag.name));

    // 找出需要创建的标签
    const missingTags = tagNames.filter((tagName) => !existingTagNames.has(tagName));

    // 批量创建缺失的标签
    if (missingTags.length > 0) {
      const tagsToCreate = missingTags.map((tagName) => ({
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
      }));

      // 确保返回结果，以保持与测试/mock 的一致性
      await this.db.insert(tags).values(tagsToCreate).returning();
    }
  }

  private async findOneWithPassword(id: number): Promise<Article> {
    const articleResult = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);

    if (articleResult.length === 0) {
      throw new NotFoundException(`Article with ID ${id} not found`);
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

  /**
   * 获取按分类分组的文章
   * 返回 Record<string, Article[]> 格式
   */
  async getArticlesGroupedByCategory(): Promise<Record<string, Article[]>> {
    const result = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.private, false), eq(articles.hidden, false)))
      .orderBy(desc(articles.updatedAt));

    const grouped: Record<string, Article[]> = {};

    for (const article of result) {
      const processedArticle = new Article({
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
      const category = processedArticle.category ?? 'Uncategorized';

      if (!(category in grouped)) {
        grouped[category] = [];
      }
      grouped[category].push(processedArticle);
    }

    return grouped;
  }

  /**
   * 获取按标签分组的文章
   * 返回 Record<string, Article[]> 格式
   */
  async getArticlesGroupedByTag(): Promise<Record<string, Article[]>> {
    const result = await this.db
      .select()
      .from(articles)
      .where(and(eq(articles.private, false), eq(articles.hidden, false)))
      .orderBy(desc(articles.updatedAt));

    const grouped: Record<string, Article[]> = {};

    for (const article of result) {
      const processedArticle = new Article({
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
      const articleTags = processedArticle.tags ?? [];

      if (articleTags.length === 0) {
        // 没有标签的文章归类到 "Untagged"
        if (!('Untagged' in grouped)) {
          grouped['Untagged'] = [];
        }
        grouped['Untagged'].push(processedArticle);
      } else {
        // 有标签的文章，每个标签都添加一份
        for (const tag of articleTags) {
          if (!(tag in grouped)) {
            grouped[tag] = [];
          }
          grouped[tag].push(processedArticle);
        }
      }
    }

    return grouped;
  }
}
