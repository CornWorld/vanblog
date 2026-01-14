import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { dayjs } from '@vanblog/shared';
import { categories, articles, articleTags } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { and, eq, sql, desc, inArray } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { ArticleListResponseDto, ArticleQueryDto } from '../article/dto/article.dto';
import { HookService } from '../plugin/services/hook.service';

import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryListResponseDto,
  CategoryWithCountDto,
  CategoryDto,
} from './dto/category.dto';
import { CategoryAccessResponseDto } from './dto/verify-password.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly statisticsService: StatisticsService,
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly hookService: HookService,
    private readonly jwtService: JwtService,
  ) {}

  async findAll(): Promise<CategoryListResponseDto> {
    const categoryResults = await this.db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        description: categories.description,
        private: categories.private,
        password: categories.password,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        articleCount: sql<number>`count(${articles.id})`,
      })
      .from(categories)
      .leftJoin(articles, and(eq(categories.name, articles.category), eq(articles.hidden, false)))
      .groupBy(categories.id);

    const total = categoryResults.length;

    const processedCategories: CategoryWithCountDto[] = categoryResults.map((category) => ({
      ...category,
      slug: category.slug,
      description: category.description,
      private: category.private,
      password: category.password,
      articleCount: category.articleCount,
      createdAt: dayjs(category.createdAt).format(),
      updatedAt: dayjs(category.updatedAt).format(),
    }));

    return {
      items: processedCategories,
      total,
    };
  }

  async findOne(id: number): Promise<CategoryDto> {
    const results = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Category with ID ${String(id)} not found`);
    }

    return {
      ...results[0],
      slug: results[0].slug ?? null,
      description: results[0].description ?? null,
      private: results[0].private ?? null,
      password: results[0].password ?? null,
      createdAt: dayjs(results[0].createdAt).format(),
      updatedAt: dayjs(results[0].updatedAt).format(),
    };
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    let categoryData = dto;

    // Trigger beforeCreate hook
    categoryData = await this.hookService.applyFilters('category|beforeCreate', categoryData, {
      action: 'create',
    });

    // Hash password if provided
    if (categoryData.password) {
      categoryData.password = await bcrypt.hash(categoryData.password, 10);
    }

    const result = await this.db.insert(categories).values(categoryData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create category');
    }

    const categoryResult = {
      ...result[0],
      slug: result[0].slug ?? null,
      description: result[0].description ?? null,
      private: result[0].private ?? null,
      password: result[0].password ?? null,
      createdAt: dayjs(result[0].createdAt).format(),
      updatedAt: dayjs(result[0].updatedAt).format(),
    };

    // Trigger webhook event
    await this.hookService.doAction('category|afterCreate', categoryResult, {
      id: categoryResult.id,
      name: categoryResult.name,
      slug: categoryResult.slug,
      description: categoryResult.description,
      private: categoryResult.private,
      createdAt: categoryResult.createdAt,
    });

    return categoryResult;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<CategoryDto> {
    let categoryData: UpdateCategoryDto = {
      name: updateCategoryDto.name,
      description: updateCategoryDto.description,
      password: updateCategoryDto.password,
    };

    // Trigger category|before_update hook
    categoryData = await this.hookService.applyFilters('category|beforeUpdate', categoryData, {
      action: 'update',
      id,
    });

    // Hash password if provided
    if (categoryData.password) {
      categoryData.password = await bcrypt.hash(categoryData.password, 10);
    }

    const result = await this.db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Category with ID ${String(id)} not found`);
    }

    // Foreign key constraint will handle cascade update automatically

    const categoryResult = {
      ...result[0],
      slug: result[0].slug ?? null,
      description: result[0].description ?? null,
      private: result[0].private ?? null,
      password: result[0].password ?? null,
      createdAt: dayjs(result[0].createdAt).format(),
      updatedAt: dayjs(result[0].updatedAt).format(),
    };

    // Trigger webhook event
    await this.hookService.doAction('category|afterUpdate', categoryResult, {
      id: categoryResult.id,
      name: categoryResult.name,
      slug: categoryResult.slug,
      description: categoryResult.description,
      private: categoryResult.private,
      updatedAt: categoryResult.updatedAt,
    });

    return categoryResult;
  }

  async remove(id: number): Promise<void> {
    // Check if category exists
    const category = await this.findOne(id);

    // Trigger category|before_delete hook
    await this.hookService.doAction(
      'category|beforeDelete',
      { id, category },
      {
        action: 'delete',
      },
    );

    // Check if there are articles in this category
    const articlesInCategory = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(eq(articles.category, category.name))
      .then((res) => res[0]?.count ?? 0);

    if (articlesInCategory > 0) {
      throw new Error(
        `Cannot delete category "${category.name}" because it contains ${String(articlesInCategory)} articles`,
      );
    }

    const result = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    if (result.length === 0) {
      throw new NotFoundException(`Category with ID ${String(id)} not found`);
    }

    // Trigger webhook event
    await this.hookService.doAction('category|afterDelete', {
      id,
      name: category.name,
    });
  }

  async getStatistics(): Promise<OverallStatisticsDto> {
    return this.statisticsService.getOverallStatistics();
  }

  async verifyPassword(id: number, password: string): Promise<CategoryAccessResponseDto> {
    const category = await this.findOne(id);

    if (!category.private || !category.password) {
      return {
        success: true,
        message: 'Category is not private',
      };
    }

    const isPasswordValid = await bcrypt.compare(password, category.password);

    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid password',
      };
    }

    // Generate access token for the category
    const token = this.jwtService.sign(
      { categoryId: category.id, categoryName: category.name },
      { expiresIn: '24h' },
    );

    return {
      success: true,
      token,
    };
  }

  async findByName(name: string): Promise<Category | null> {
    const results = await this.db
      .select()
      .from(categories)
      .where(eq(categories.name, name))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return new Category({
      ...results[0],
      slug: results[0].slug ?? undefined,
      description: results[0].description ?? undefined,
      private: results[0].private ?? undefined,
      password: results[0].password ?? undefined,
    });
  }

  /**
   * 获取分类及其关联的标签统计
   *
   * 返回所有分类以及每个分类下的标签使用情况
   * 使用优化的查询策略，一次性获取所有数据后在内存中分组，避免 N+1 查询问题
   *
   * @returns 分类和标签统计数据数组
   */
  async getCategoriesWithTags(): Promise<
    {
      category: Category;
      tags: { name: string; count: number }[];
    }[]
  > {
    return await this.queryOptimizer.withPerformanceMonitoring(
      'CategoryService.getCategoriesWithTags',
      async () => {
        // 获取所有分类
        const categoryList = await this.db.select().from(categories);

        // 获取所有文章的分类和标签信息（分开查询，不使用 JOIN）
        const allArticles = await this.db
          .select({
            id: articles.id,
            category: articles.category,
          })
          .from(articles)
          .where(sql`${articles.category} IS NOT NULL`);

        // 获取所有文章标签关联
        const articleIds = allArticles.map((a) => a.id);
        const allArticleTags =
          articleIds.length > 0
            ? await this.db
                .select({
                  articleId: articleTags.articleId,
                  tagName: articleTags.tagName,
                })
                .from(articleTags)
                .where(inArray(articleTags.articleId, articleIds))
            : [];

        // 构建 articleId -> tagName[] 映射
        const tagMap = new Map<number, string[]>();
        for (const tag of allArticleTags) {
          const existing = tagMap.get(tag.articleId) ?? [];
          existing.push(tag.tagName);
          tagMap.set(tag.articleId, existing);
        }

        // 构建 category -> tagName[] 映射（通过文章关联）
        const articlesByCategory = new Map<string, string[]>();
        for (const article of allArticles) {
          const tags = tagMap.get(article.id) ?? [];
          if (article.category) {
            const existing = articlesByCategory.get(article.category) ?? [];
            existing.push(...tags);
            articlesByCategory.set(article.category, existing);
          }
        }

        // 处理每个分类的标签统计
        const results = categoryList.map((category) => {
          const categoryTags = articlesByCategory.get(category.name) ?? [];

          // 统计标签出现次数
          const tagCount = new Map<string, number>();
          categoryTags.forEach((tag) => {
            tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
          });

          return {
            category: new Category({
              ...category,
              slug: category.slug ?? undefined,
              description: category.description ?? undefined,
              private: category.private ?? undefined,
              password: category.password ?? undefined,
            }),
            tags: Array.from(tagCount.entries()).map(([name, count]) => ({
              name,
              count,
            })),
          };
        });

        return results;
      },
    );
  }

  async getArticlesByCategoryId(
    id: number,
    query: ArticleQueryDto,
  ): Promise<ArticleListResponseDto> {
    // 首先验证分类是否存在
    const category = await this.findOne(id);

    const { page = 1, pageSize = 10, includeHidden = false } = query;

    // 构建查询条件：查找该分类下的文章
    const whereClause = and(
      eq(articles.category, category.name),
      includeHidden ? undefined : eq(articles.hidden, false),
    );

    // 构建排序条件
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

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      items: processedArticles,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
