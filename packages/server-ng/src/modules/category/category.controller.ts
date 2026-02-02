import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { z } from 'zod';

import { ArticleListResponseSchema, ArticleQuerySchema } from '../article/dto/article.dto';
import { Permission } from '../auth/permissions.decorator';

import { CreateCategorySchema, UpdateCategorySchema } from './dto/category.dto';
import { CategoryService } from './category.service';
import { Category } from './entities/category.entity';

/**
 * 分类管理控制器
 *
 * 提供分类的完整 CRUD 操作，包括创建、查询、更新、删除分类。
 * 支持分类统计信息和分类与文章的关联查询功能。
 *
 * NOTE: Uses main contract.ts for ts-rest handlers, not createCategoryContract factory.
 * The main contract uses :name params for update/delete while categoryContract uses :id.
 */
@ApiTags('Categories')
@Controller({ path: 'categories', version: '2' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Health check endpoint to verify controller is loaded
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  async health(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  /**
   * Get all categories (standard NestJS route as fallback for ts-rest issues)
   */
  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  async getAllCategories() {
    const result = await this.categoryService.findAll();
    // Return just category names as strings for frontend compatibility
    return result.items.map((item) => item.name);
  }

  /**
   * 根据 ID 获取分类 (standard NestJS route for backward compatibility)
   *
   * 根据分类 ID 查询单个分类的详细信息。
   *
   * @param id 分类 ID
   * @returns 分类详细信息
   */
  @Get('id/:id')
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
  @ApiOperation({ summary: 'Get articles by category name' })
  @ApiResponse({ status: 200, description: 'Return articles by category name' })
  async getArticlesByCategoryName(
    @Param('name') name: string,
    @Query() raw: unknown,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw ?? {});
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
  @Get('id/:id/articles')
  @ApiOperation({ summary: 'Get articles by category ID' })
  @ApiResponse({ status: 200, description: 'Return articles by category ID' })
  async getArticlesByCategoryId(
    @Param('id', ParseIntPipe) id: number,
    @Query() raw: unknown,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw ?? {});
    return this.categoryService.getArticlesByCategoryId(id, query);
  }

  /**
   * 创建新分类 (standard NestJS route)
   *
   * 创建一个新的分类，用于文章分类和组织。
   *
   * @param createCategoryDto 分类创建数据
   * @returns 创建的分类信息
   */
  @Post()
  @Permission('category', ['create'])
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Create new category' })
  async create(@Body() raw: unknown): Promise<Category> {
    const dto = CreateCategorySchema.parse(raw);
    const result = await this.categoryService.create(dto);
    return {
      ...result,
      description: result.description ?? undefined,
    } as Category;
  }

  /**
   * 更新分类 (standard NestJS route, by name)
   *
   * 根据分类名称更新分类信息。
   *
   * @param name 分类名称
   * @param updateCategoryDto 分类更新数据
   * @returns 更新后的分类信息
   */
  @Put('name/:name')
  @Permission('category', ['update'])
  @ApiOperation({ summary: 'Update category by name' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateByName(@Param('name') name: string, @Body() raw: unknown): Promise<Category> {
    const dto = UpdateCategorySchema.parse(raw);
    const result = await this.categoryService.updateByName(name, dto);
    return {
      ...result,
      description: result.description ?? undefined,
    } as Category;
  }

  /**
   * 更新分类 (standard NestJS route, by ID for backward compatibility)
   *
   * 根据分类 ID 更新分类信息。
   *
   * @param id 分类 ID
   * @param updateCategoryDto 分类更新数据
   * @returns 更新后的分类信息
   */
  @Put('id/:id')
  @Permission('category', ['update'])
  @ApiOperation({ summary: 'Update category by ID' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() raw: unknown): Promise<Category> {
    const dto = UpdateCategorySchema.parse(raw);
    const result = await this.categoryService.update(id, dto);
    return {
      ...result,
      description: result.description ?? undefined,
    } as Category;
  }

  /**
   * 删除分类 (standard NestJS route, by name)
   *
   * 根据分类名称删除分类。
   *
   * @param name 分类名称
   * @returns 删除成功响应
   */
  @Delete('name/:name')
  @Permission('category', ['delete'])
  @ApiOperation({ summary: 'Delete category by name' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deleteByName(@Param('name') name: string): Promise<{ success: boolean }> {
    await this.categoryService.removeByName(name);
    return { success: true };
  }

  /**
   * 删除分类 (standard NestJS route, by ID for backward compatibility)
   *
   * 根据分类 ID 删除分类。
   *
   * @param id 分类 ID
   * @returns 删除成功响应
   */
  @Delete('id/:id')
  @Permission('category', ['delete'])
  @ApiOperation({ summary: 'Delete category by ID' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    await this.categoryService.remove(id);
    return { success: true };
  }

  @TsRestHandler(contract.getCategories)
  @Permission('category', ['read'])
  @Get()
  getCategories(): unknown {
    return tsRestHandler(contract.getCategories, async () => {
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

  @TsRestHandler(contract.createCategory)
  @Permission('category', ['create'])
  @Post()
  createCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createCategory, async ({ body }) => {
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

  @TsRestHandler(contract.updateCategory)
  @Permission('category', ['update'])
  @Put()
  updateCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateCategory, async ({ params, body }) => {
      const result = await this.categoryService.updateByName(params.name, body);
      return {
        status: 200,
        body: { ...result, description: result.description ?? undefined },
      };
    });
  }

  @TsRestHandler(contract.deleteCategory)
  @Permission('category', ['delete'])
  @Delete()
  deleteCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteCategory, async ({ params }) => {
      await this.categoryService.removeByName(params.name);
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getArticlesByCategory)
  @Permission('category', ['read'])
  @Get()
  getArticlesByCategory(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getArticlesByCategory, async ({ params }) => {
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
      return { status: 200, body: items };
    });
  }
}
