import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { initContract } from '@ts-rest/core';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { createCategoryContract } from '@vanblog/shared/contracts';
import { z } from 'zod';

import { ArticleListResponseSchema, ArticleQuerySchema } from '../article/dto/article.dto';
import { Permission } from '../auth/permissions.decorator';

import { CategoryService } from './category.service';
import { Category } from './entities/category.entity';

const c = initContract();
const categoryContract = createCategoryContract(c);

/**
 * 分类管理控制器
 *
 * 提供分类的完整 CRUD 操作，包括创建、查询、更新、删除分类。
 * 支持分类统计信息和分类与文章的关联查询功能。
 */
@ApiTags('Categories')
@Controller({ path: 'categories', version: '2' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * 根据 ID 获取分类
   *
   * 根据分类 ID 查询单个分类的详细信息。
   *
   * @param id 分类 ID
   * @returns 分类详细信息
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Return category by ID' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Category> {
    return this.categoryService.findOne(id);
  }

  /**
   * 根据分类名称获取文章列表
   *
   * 根据分类名称查询该分类下的所有文章，支持分页和筛选。
   *
   * @param name 分类名称
   * @param query 查询参数
   * @returns 文章列表响应数据
   */
  @Get('name/:name/articles')
  @Permission('category', ['read'])
  @ApiOperation({ summary: 'Get articles by category name' })
  @ApiResponse({ status: 200, description: 'Return articles by category name' })
  async getArticlesByCategoryName(
    @Param('name') name: string,
    @Query() raw: unknown,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw);
    return this.categoryService.getArticlesByCategoryName(name, query);
  }

  /**
   * 根据分类 ID 获取文章列表
   *
   * 根据分类 ID 查询该分类下的所有文章，支持分页和筛选。
   *
   * @param id 分类 ID
   * @param query 查询参数
   * @returns 文章列表响应数据
   */
  @Get(':id/articles')
  @Permission('category', ['read'])
  @ApiOperation({ summary: 'Get articles by category ID' })
  @ApiResponse({ status: 200, description: 'Return articles by category ID' })
  async getArticlesByCategoryId(
    @Param('id', ParseIntPipe) id: number,
    @Query() raw: unknown,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw);
    return this.categoryService.getArticlesByCategoryId(id, query);
  }

  @TsRestHandler(categoryContract.getCategories)
  @Permission('category', ['read'])
  getCategories(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.getCategories, async () => {
      const result = await this.categoryService.findAll();
      const body = result.items.map((item) => ({
        id: item.id,
        name: item.name,
        count: item.articleCount,
        description: item.description ?? undefined,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      return { status: 200, body };
    });
  }

  @TsRestHandler(categoryContract.getCategoryById)
  @Permission('category', ['read'])
  getCategoryById(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.getCategoryById, async ({ params }) => {
      const id = parseInt(params.id, 10);
      const result = await this.categoryService.findOne(id);
      return { status: 200, body: result };
    });
  }

  @TsRestHandler(categoryContract.createCategory)
  @Permission('category', ['create'])
  createCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.createCategory, async ({ body }) => {
      const result = await this.categoryService.create({
        ...body,
        name: body.name,
      });
      return {
        status: 201,
        body: { ...result, description: result.description ?? undefined },
      };
    });
  }

  @TsRestHandler(categoryContract.updateCategory)
  @Permission('category', ['update'])
  updateCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.updateCategory, async ({ params, body }) => {
      const id = parseInt(params.id, 10);
      const result = await this.categoryService.update(id, body);
      return {
        status: 200,
        body: { ...result, description: result.description ?? undefined },
      };
    });
  }

  @TsRestHandler(categoryContract.deleteCategory)
  @Permission('category', ['delete'])
  deleteCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.deleteCategory, async ({ params }) => {
      const id = parseInt(params.id, 10);
      await this.categoryService.remove(id);
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(categoryContract.getArticlesByCategory)
  @Permission('category', ['read'])
  getArticlesByCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.getArticlesByCategory, async ({ params }) => {
      const id = parseInt(params.id, 10);
      const result = await this.categoryService.getArticlesByCategoryId(id, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const items = result.items.map((t) => {
        const views = t.viewer ?? 0;
        const top = t.top ?? 0;
        const password = typeof t.password === 'string' ? t.password : undefined;
        const category = typeof t.category === 'string' ? t.category : undefined;
        return {
          id: t.id,
          title: t.title,
          content: t.content,
          summary: undefined,
          cover: undefined,
          category: category ?? undefined,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: t.updatedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          private: password !== undefined,
          password,
          toc: undefined,
        };
      });
      return { status: 200, body: { ...result, items } };
    });
  }

  @TsRestHandler(categoryContract.getArticlesByCategoryName)
  @Permission('category', ['read'])
  getArticlesByCategoryName(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(categoryContract.getArticlesByCategoryName, async ({ params }) => {
      const result = await this.categoryService.getArticlesByCategoryName(params.name, {
        page: 1,
        pageSize: 1000,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      const items = result.items.map((t) => {
        const views = t.viewer ?? 0;
        const top = t.top ?? 0;
        const password = typeof t.password === 'string' ? t.password : undefined;
        const category = typeof t.category === 'string' ? t.category : undefined;
        return {
          id: t.id,
          title: t.title,
          content: t.content,
          summary: undefined,
          cover: undefined,
          category: category ?? undefined,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: t.updatedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          private: password !== undefined,
          password,
          toc: undefined,
        };
      });
      return { status: 200, body: { ...result, items } };
    });
  }
}
