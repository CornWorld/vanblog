import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  ArticleListResponseDto,
  ArticleSearchDto,
  ArticleSearchResponseDto,
} from './dto/article.dto';
import { articles, tags } from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database';
import type { Database } from '../../database/connection';
import { Article } from './entities/article.entity';
import { safeParseJson, dataSchemas } from '../../shared/zod';

@Injectable()
export class ArticleService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
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
    if (keyword) {
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
      summary: undefined,
      cover: undefined,
      tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
      categories: article.category ? [article.category] : [],
      isPublished: !article.hidden,
      isTop: Boolean(article.top),
      password: article.password,
      allowComment: true,
      copyright: undefined,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      publishedAt: article.updatedAt,
      viewCount: article.viewer ?? 0,
      likeCount: 0,
      commentCount: 0,
      wordCount: 0,
      readTime: 0,
    }));

    const total = Number(countResult[0]?.count || 0);
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
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const whereConditions = [];
    if (category) {
      whereConditions.push(eq(articles.category, String(category)));
    }
    if (Array.isArray(tags) && tags.length > 0) {
      const tagConditions = tags.map((tag: string) => like(articles.tags, `%"${String(tag)}"%`));
      whereConditions.push(or(...tagConditions));
    }
    if (keyword) {
      whereConditions.push(
        or(
          like(articles.title, `%${String(keyword)}%`),
          like(articles.content, `%${String(keyword)}%`),
        ),
      );
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

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / Number(pageSize));

    return {
      items: processedArticles,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findOne(id: number): Promise<Article> {
    const articleResult = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);

    if (articleResult.length === 0) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    const article = articleResult[0];
    return new Article({
      ...article,
      tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
      pathname: article.pathname ?? undefined,
      category: article.category ?? undefined,
      author: article.author,
      top: article.top ?? undefined,
      hidden: article.hidden ?? undefined,
      private: article.private ?? undefined,
      password: article.password ?? undefined,
      viewer: article.viewer ?? undefined,
    });
  }

  async create(createArticleDto: CreateArticleDto): Promise<Article> {
    const { tags: tagNames, ...articleData } = createArticleDto;

    // Create missing tags
    if (Array.isArray(tagNames) && tagNames.length > 0) {
      await this.createMissingTags(tagNames);
    }

    const newArticleData = {
      title: String(articleData.title),
      content: String(articleData.content),
      pathname: articleData.pathname ? String(articleData.pathname) : undefined,
      category: articleData.category ? String(articleData.category) : undefined,
      author: articleData.author ? String(articleData.author) : 'admin',
      top: articleData.top ? Number(articleData.top) : undefined,
      hidden: articleData.hidden ? Boolean(articleData.hidden) : undefined,
      private: articleData.private ? Boolean(articleData.private) : undefined,
      password: articleData.password ? String(articleData.password) : undefined,
      viewer: 0,
      tags: JSON.stringify(Array.isArray(tagNames) ? tagNames : []),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertResult = await this.db.insert(articles).values([newArticleData]).returning();

    const newArticle = insertResult[0];
    return new Article({
      ...newArticle,
      tags: safeParseJson(newArticle.tags, dataSchemas.tagsArray) ?? [],
      pathname: newArticle.pathname ?? undefined,
      category: newArticle.category ?? undefined,
      author: newArticle.author,
      top: newArticle.top ?? undefined,
      hidden: newArticle.hidden ?? undefined,
      private: newArticle.private ?? undefined,
      password: newArticle.password ?? undefined,
      viewer: newArticle.viewer ?? undefined,
    });
  }

  async update(id: number, updateArticleDto: UpdateArticleDto): Promise<Article> {
    // Verify article exists (will throw if not found)
    await this.findOne(id);

    const { tags: tagNames, ...articleData } = updateArticleDto;

    // Create missing tags
    if (Array.isArray(tagNames) && tagNames.length > 0) {
      await this.createMissingTags(tagNames);
    }

    const updateData = {
      ...Object.fromEntries(
        Object.entries(articleData).map(([key, value]) => [
          key,
          typeof value === 'string' ? value : String(value),
        ]),
      ),
      ...(tagNames !== undefined && { tags: JSON.stringify(tagNames) }),
      updatedAt: new Date(),
    };

    const updateResult = await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    const updatedArticle = updateResult[0];
    return new Article({
      ...updatedArticle,
      tags: safeParseJson(updatedArticle.tags, dataSchemas.tagsArray) ?? [],
      pathname: updatedArticle.pathname ?? undefined,
      category: updatedArticle.category ?? undefined,
      author: updatedArticle.author,
      top: updatedArticle.top ?? undefined,
      hidden: updatedArticle.hidden ?? undefined,
      private: updatedArticle.private ?? undefined,
      password: updatedArticle.password ?? undefined,
      viewer: updatedArticle.viewer ?? undefined,
    });
  }

  async remove(id: number): Promise<void> {
    await this.db.delete(articles).where(eq(articles.id, id));
  }

  async exportArticles(): Promise<Article[]> {
    const articleResults = await this.db.select().from(articles);
    return articleResults.map(
      (article) =>
        new Article({
          id: article.id,
          title: article.title,
          content: article.content,
          pathname: article.pathname ?? undefined,
          tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
          category: article.category ?? undefined,
          author: article.author,
          top: article.top ?? undefined,
          hidden: article.hidden ?? undefined,
          private: article.private ?? undefined,
          password: article.password ?? undefined,
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

  async findByCategory(categoryName: string): Promise<ArticleListResponseDto> {
    const articleResults = await this.db
      .select()
      .from(articles)
      .where(eq(articles.category, String(categoryName)))
      .orderBy(desc(articles.updatedAt));

    const processedArticles = articleResults.map((article) => ({
      id: article.id,
      title: article.title,
      content: article.content,
      tags: safeParseJson(article.tags, dataSchemas.tagsArray) ?? [],
      categories: article.category ? [article.category] : [],
      isPublished: !article.hidden,
      isTop: Boolean(article.top),
      allowComment: true,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      viewCount: article.viewer ?? 0,
      likeCount: 0,
      commentCount: 0,
      wordCount: 0,
      readTime: 0,
      publishedAt: article.updatedAt,
    }));

    return {
      items: processedArticles,
      total: processedArticles.length,
      page: 1,
      pageSize: processedArticles.length,
      totalPages: 1,
    };
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
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    }
  }
}
