import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  ArticleListResponseDto,
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
      author: article.author ?? 'admin',
      top: article.top ?? 0,
      hidden: article.hidden ?? false,
      private: article.private ?? false,
      password: article.password ?? undefined,
      viewer: article.viewer ?? 0,
    }));

    return {
      data: processedArticles.map((article) => new Article(article)),
      total: countResult[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async findOne(id: number): Promise<Article> {
    const results = await this.db.select().from(articles).where(eq(articles.id, id)).limit(1);

    const article = results[0];

    if (!article) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    return new Article({
      ...article,
      tags: article.tags ? (JSON.parse(article.tags) as string[]) : [],
      pathname: article.pathname ?? undefined,
      category: article.category ?? undefined,
      author: article.author ?? 'admin',
      top: article.top ?? 0,
      hidden: article.hidden ?? false,
      private: article.private ?? false,
      password: article.password ?? undefined,
      viewer: article.viewer ?? 0,
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

    const newArticle = result[0];

    if (!newArticle) {
      throw new Error('Failed to create article');
    }

    return new Article({
      ...newArticle,
      tags: newArticle.tags ? (JSON.parse(newArticle.tags) as string[]) : [],
      pathname: newArticle.pathname ?? undefined,
      category: newArticle.category ?? undefined,
      author: newArticle.author ?? 'admin',
      top: newArticle.top ?? 0,
      hidden: newArticle.hidden ?? false,
      private: newArticle.private ?? false,
      password: newArticle.password ?? undefined,
      viewer: newArticle.viewer ?? 0,
    });
  }

  async update(id: number, updateArticleDto: UpdateArticleDto): Promise<Article> {
    const { tags, ...rest } = updateArticleDto;

    const updateData: Record<string, unknown> = {};

    if (rest.title !== undefined) {
      updateData.title = rest.title;
    }

    if (rest.content !== undefined) {
      updateData.content = rest.content;
    }

    if (rest.pathname !== undefined) {
      updateData.pathname = rest.pathname;
    }

    if (tags !== undefined) {
      updateData.tags = JSON.stringify(tags);
    }
    if (rest.category !== undefined) {
      updateData.category = rest.category;
    }
    if (rest.author !== undefined) {
      updateData.author = rest.author;
    }
    if (rest.top !== undefined) {
      updateData.top = rest.top;
    }
    if (rest.hidden !== undefined) {
      updateData.hidden = rest.hidden;
    }
    if (rest.private !== undefined) {
      updateData.private = rest.private;
    }
    if (rest.password !== undefined) {
      updateData.password = rest.password;
    }

    updateData.updatedAt = new Date();

    const result = await this.db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    const updatedArticle = result[0];

    if (!updatedArticle) {
      throw new NotFoundException(`Article with ID ${String(id)} not found`);
    }

    return new Article({
      ...updatedArticle,
      tags: updatedArticle.tags ? (JSON.parse(updatedArticle.tags) as string[]) : [],
      pathname: updatedArticle.pathname ?? undefined,
      category: updatedArticle.category ?? undefined,
      author: updatedArticle.author ?? 'admin',
      top: updatedArticle.top ?? 0,
      hidden: updatedArticle.hidden ?? false,
      private: updatedArticle.private ?? false,
      password: updatedArticle.password ?? undefined,
      viewer: updatedArticle.viewer ?? 0,
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

  async incrementViewer(id: number): Promise<void> {
    await this.db
      .update(articles)
      .set({
        viewer: sql`${articles.viewer} + 1`,
      })
      .where(eq(articles.id, id));
  }
}
