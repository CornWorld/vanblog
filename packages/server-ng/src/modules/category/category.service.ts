import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryListResponseDto,
  CategoryWithCountDto,
} from './dto/category.dto';
import { categories, articles } from '../../db/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { Database } from '../../db/connection';
import { Category } from './entities/category.entity';
import { StatisticsService } from '../../shared/services/statistics.service';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { CategoryAccessResponseDto } from './dto/verify-password.dto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly statisticsService: StatisticsService,
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
      slug: category.slug ?? undefined,
      description: category.description ?? undefined,
      private: category.private ?? undefined,
      password: category.password ?? undefined,
      articleCount: Number(category.articleCount) || 0,
    }));

    return {
      data: processedCategories,
      total: total,
    };
  }

  async findOne(id: number): Promise<Category> {
    const results = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Category with ID ${String(id)} not found`);
    }

    return new Category({
      ...results[0],
      slug: results[0].slug ?? undefined,
      description: results[0].description ?? undefined,
      private: results[0].private ?? undefined,
      password: results[0].password ?? undefined,
    });
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const categoryData = Object.assign({}, createCategoryDto);

    // Hash password if provided
    if (categoryData.password) {
      categoryData.password = await bcrypt.hash(categoryData.password, 10);
    }

    const result = await this.db.insert(categories).values(categoryData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create category');
    }

    return new Category({
      ...result[0],
      slug: result[0].slug ?? undefined,
      description: result[0].description ?? undefined,
      private: result[0].private ?? undefined,
      password: result[0].password ?? undefined,
    });
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const categoryData = Object.assign({}, updateCategoryDto);

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

    return new Category({
      ...result[0],
      slug: result[0].slug ?? undefined,
      description: result[0].description ?? undefined,
      private: result[0].private ?? undefined,
      password: result[0].password ?? undefined,
    });
  }

  async remove(id: number): Promise<void> {
    // Check if category exists
    const category = await this.findOne(id);

    // Check if there are articles in this category
    const articlesInCategory = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(eq(articles.category, category.name))
      .then((res) => Number(res[0]?.count || 0));

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
            const articleTags = JSON.parse(article.tags) as string[];
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
