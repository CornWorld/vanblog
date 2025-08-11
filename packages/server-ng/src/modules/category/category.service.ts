import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import { eq, sql } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';

import { DATABASE_CONNECTION } from '../../database';
import { categories, articles } from '../../database/schema';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { StatisticsService } from '../../shared/services/statistics.service';
import { safeParseJson, dataSchemas } from '../../shared/zod';
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

import type { Database } from '../../database/connection';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly statisticsService: StatisticsService,
    private readonly hookService: HookService,
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
      .leftJoin(articles, eq(categories.name, articles.category))
      .groupBy(categories.id);

    const total = categoryResults.length;

    const processedCategories: CategoryWithCountDto[] = categoryResults.map((category) => ({
      ...category,
      slug: category.slug,
      description: category.description,
      private: category.private,
      password: category.password,
      articleCount: Number(category.articleCount) > 0 ? Number(category.articleCount) : 0,
      createdAt: dayjs(category.createdAt),
      updatedAt: dayjs(category.updatedAt),
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
      createdAt: dayjs(results[0].createdAt),
      updatedAt: dayjs(results[0].updatedAt),
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
      createdAt: dayjs(result[0].createdAt),
      updatedAt: dayjs(result[0].updatedAt),
    };

    // Trigger afterCreate hook
    await this.hookService.doAction('category|afterCreate', categoryResult, {
      action: 'create',
    });

    // Trigger webhook event
    await this.hookService.doAction('category.created', {
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

    // Trigger beforeUpdate hook
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
      createdAt: dayjs(result[0].createdAt),
      updatedAt: dayjs(result[0].updatedAt),
    };

    // Trigger afterUpdate hook
    await this.hookService.doAction('category|afterUpdate', categoryResult, {
      action: 'update',
      id,
    });

    // Trigger webhook event
    await this.hookService.doAction('category.updated', {
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

    // Trigger beforeDelete hook
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
      .then((res) => (Number(res[0]?.count) > 0 ? Number(res[0]?.count) : 0));

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

    // Trigger afterDelete hook
    await this.hookService.doAction(
      'category|afterDelete',
      { id, category },
      {
        action: 'delete',
      },
    );

    // Trigger webhook event
    await this.hookService.doAction('category.deleted', {
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
    const token = jwt.sign(
      { categoryId: category.id, categoryName: category.name },
      process.env.JWT_SECRET ?? 'default-secret',
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

  async getCategoriesWithTags(): Promise<
    {
      category: Category;
      tags: { name: string; count: number }[];
    }[]
  > {
    const categoryList = await this.db.select().from(categories);

    const results = await Promise.all(
      categoryList.map(async (category) => {
        // Get all articles in this category
        const articlesInCategory = await this.db
          .select({
            tags: articles.tags,
          })
          .from(articles)
          .where(eq(articles.category, category.name));

        // Extract and count tags
        const tagCount = new Map<string, number>();
        articlesInCategory.forEach((article) => {
          if (article.tags) {
            const articleTags = safeParseJson(article.tags, dataSchemas.tagsArray) ?? [];
            articleTags.forEach((tag) => {
              tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
            });
          }
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
      }),
    );

    return results;
  }
}
