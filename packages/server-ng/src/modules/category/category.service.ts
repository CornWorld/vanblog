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

@Injectable()
export class CategoryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
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
    const result = await this.db.insert(categories).values(createCategoryDto).returning();

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
    const result = await this.db
      .update(categories)
      .set(updateCategoryDto)
      .where(eq(categories.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Category with ID ${String(id)} not found`);
    }

    return new Category({
      ...result[0],
      slug: result[0].slug ?? undefined,
      description: result[0].description ?? undefined,
      private: result[0].private ?? undefined,
      password: result[0].password ?? undefined,
    });
  }

  async remove(id: number): Promise<void> {
    const result = await this.db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });

    if (result.length === 0) {
      throw new NotFoundException(`Category with ID ${String(id)} not found`);
    }
  }
}
