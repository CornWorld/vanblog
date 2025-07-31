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
import { articles } from '../../db/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { Database } from '../../db/connection';
import { Article } from './entities/article.entity';

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
      keyword,
      category,
      tag,
      includeHidden = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const conditions = [];

    if (keyword) {
      conditions.push(
        or(like(articles.title, `%${keyword}%`), like(articles.content, `%${keyword}%`)),
      );
    }

    if (category) {
      conditions.push(eq(articles.category, category));
    }

    if (tag) {
      conditions.push(like(articles.tags, `%"${tag}"%`));
    }

    if (!includeHidden) {
      conditions.push(eq(articles.hidden, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    const processedArticles = articleResults.map((article) => ({
      ...article,
      tags: article.tags ? (JSON.parse(article.tags) as string[]) : [],
      pathname: article.pathname ?? undefined,
      category: article.category ?? undefined,
      author: article.author,
      top: article.top ?? undefined,
      hidden: article.hidden ?? undefined,
      private: article.private ?? undefined,
      password: article.password ?? undefined,
      viewer: article.viewer ?? undefined,
    }));

    return {
      data: processedArticles.map((article) => new Article(article)),
      total: countResult[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async search(query: ArticleSearchDto): Promise<ArticleSearchResponseDto> {
    const startTime = Date.now();
    const {
      query: searchTerm,
      page = 1,
      pageSize = 10,
      titleOnly = false,
      contentOnly = false,
      category,
      tags,
      includeHidden = false,
      includePrivate = false,
      sortBy = 'relevance',
      sortOrder = 'desc',
    } = query;

    const conditions = [];

    if (searchTerm) {
      if (titleOnly) {
        conditions.push(like(articles.title, `%${searchTerm}%`));
      } else if (contentOnly) {
        conditions.push(like(articles.content, `%${searchTerm}%`));
      } else {
        conditions.push(
          or(like(articles.title, `%${searchTerm}%`), like(articles.content, `%${searchTerm}%`)),
        );
      }
    }

    if (category) {
      conditions.push(eq(articles.category, category));
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map((tag) => like(articles.tags, `%"${tag}"%`));
      conditions.push(or(...tagConditions));
    }

    if (!includeHidden) {
      conditions.push(eq(articles.hidden, false));
    }

    if (!includePrivate) {
      conditions.push(eq(articles.private, false));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(articles)
        .where(whereClause),
    ]);

    const processedArticles = articleResults.map((article) => ({
      ...article,
      tags: article.tags ? (JSON.parse(article.tags) as string[]) : [],
      pathname: article.pathname ?? undefined,
      category: article.category ?? undefined,
      author: article.author,
      top: article.top ?? undefined,
      hidden: article.hidden ?? undefined,
      private: article.private ?? undefined,
      password: article.password ?? undefined,
      viewer: article.viewer ?? undefined,
    }));

    const searchTime = Date.now() - startTime;

    return {
      data: processedArticles.map((article) => new Article(article)),
      total: countResult[0]?.count ?? 0,
      page,
      pageSize,
      query: searchTerm,
      searchTime,
    };
  }

  async findOne(id: number): Promise<Article> {
    const results = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    const article = results[0];

    return new Article({
      ...article,
      tags: article.tags ? (JSON.parse(article.tags) as string[]) : [],
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
    const { tags, ...rest } = createArticleDto;

    const result = await this.db
      .insert(articles)
      .values({
        title: rest.title,
        content: rest.content,
        pathname: rest.pathname ?? null,
        tags: tags ? JSON.stringify(tags) : null,
        category: rest.category ?? null,
        author: rest.author ?? 'admin',
        top: rest.top ?? 0,
        hidden: rest.hidden ?? false,
        private: rest.private ?? false,
        password: rest.password ?? null,
        viewer: 0,
      })
      .returning();

    if (result.length === 0) {
      throw new Error('Failed to create article');
    }

    const newArticle = result[0];

    return new Article({
      ...newArticle,
      tags: newArticle.tags ? (JSON.parse(newArticle.tags) as string[]) : [],
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
    const { tags, ...rest } = updateArticleDto;

    const updateData: Record<string, unknown> = {};

    if ('title' in rest) {
      updateData.title = rest.title;
    }

    if ('content' in rest) {
      updateData.content = rest.content;
    }

    if ('pathname' in rest) {
      updateData.pathname = rest.pathname ?? null;
    }

    if (tags !== undefined) {
      updateData.tags = JSON.stringify(tags);
    }
    if ('category' in rest) {
      updateData.category = rest.category ?? null;
    }
    if ('author' in rest) {
      updateData.author = rest.author;
    }
    if ('top' in rest) {
      updateData.top = rest.top;
    }
    if ('hidden' in rest) {
      updateData.hidden = rest.hidden;
    }
    if ('private' in rest) {
      updateData.private = rest.private;
    }
    if ('password' in rest) {
      updateData.password = rest.password ?? null;
    }

    updateData.updatedAt = new Date();

    const result = await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    const updatedArticle = result[0];

    return new Article({
      ...updatedArticle,
      tags: updatedArticle.tags ? (JSON.parse(updatedArticle.tags) as string[]) : [],
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
    const result = await this.db
      .delete(articles)
      .where(eq(articles.id, id))
      .returning({ id: articles.id });

    if (result.length === 0) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }
  }

  async exportArticles(): Promise<Article[]> {
    const articleResults = await this.db.select().from(articles);
    return articleResults.map(
      (article) =>
        new Article({
          ...article,
          tags: article.tags ? (JSON.parse(article.tags) as string[]) : [],
          pathname: article.pathname ?? undefined,
          category: article.category ?? undefined,
          author: article.author,
          top: article.top ?? undefined,
          hidden: article.hidden ?? undefined,
          private: article.private ?? undefined,
          password: article.password ?? undefined,
          viewer: article.viewer ?? undefined,
        }),
    );
  }

  async importArticles(articleDtos: CreateArticleDto[]): Promise<void> {
    for (const articleDto of articleDtos) {
      await this.create(articleDto);
    }
  }

  async incrementViewer(id: number): Promise<void> {
    await this.db
      .update(articles)
      .set({
        viewer: sql`${articles.viewer} + 1`,
      })
      .where(eq(articles.id, id));
  }
}
