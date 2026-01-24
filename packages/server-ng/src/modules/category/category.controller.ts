import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, type Category as SharedCategory } from '@vanblog/shared';
import { z } from 'zod';

import { ArticleListResponseSchema, ArticleQuerySchema } from '../article/dto/article.dto';
import { Permission } from '../auth/permissions.decorator';

import { CategoryListResponseSchema, CreateCategorySchema, UpdateCategorySchema } from './dto/category.dto';
import { Category } from './entities/category.entity';
import { CategoryService } from './category.service';

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
   * 获取所有分类
   *
   * 查询系统中的所有分类列表，包含分类的基本信息和使用统计。
   *
   * @returns 分类列表响应数据
   */
  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Return all categories' })
  async findAll(): Promise<z.infer<typeof CategoryListResponseSchema>> {
    return this.categoryService.findAll();
  }

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
   * 创建新分类
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
    return this.categoryService.create(dto);
  }

  /**
   * 更新分类
   *
   * 根据分类 ID 更新分类的信息，如名称、描述等。
   *
   * @param id 分类 ID
   * @param updateCategoryDto 分类更新数据
   * @returns 更新后的分类信息
   */
  @Put(':id')
  @Permission('category', ['update'])
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, description: 'Update existing category' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() raw: unknown): Promise<Category> {
    const dto = UpdateCategorySchema.parse(raw);
    return this.categoryService.update(id, dto);
  }

  /**
   * 删除分类
   *
   * 根据分类 ID 删除指定分类。删除前会检查分类是否被文章使用。
   *
   * @param id 分类 ID
   */
  @Delete(':id')
  @Permission('category', ['delete'])
  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoryService.remove(id);
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
  @ApiResponse({ status: 404, description: 'Category not found' })
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
  @ApiOperation({ summary: 'Get articles by category ID' })
  @ApiResponse({ status: 200, description: 'Return articles by category ID' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getArticlesByCategoryId(
    @Param('id', ParseIntPipe) id: number,
    @Query() raw: unknown,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw);
    return this.categoryService.getArticlesByCategoryId(id, query);
  }

  @TsRestHandler(contract.getCategories)
  getCategories(): unknown {
    return tsRestHandler(contract.getCategories, async () => {
      const result = await this.categoryService.findAll();
      const body: SharedCategory[] = result.items.map((item) => ({
        id: item.id,
        name: item.name,
        count: item.articleCount,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt ?? undefined,
      }));
      return { status: 200, body };
    });
  }

  @TsRestHandler(contract.createCategory)
  createCategory(): unknown {
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
  updateCategory(): unknown {
    return tsRestHandler(contract.updateCategory, async ({ params, body }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.update(category.id, body);
      return {
        status: 200,
        body: { ...result, description: result.description ?? undefined },
      };
    });
  }

  @TsRestHandler(contract.deleteCategory)
  deleteCategory(): unknown {
    return tsRestHandler(contract.deleteCategory, async ({ params }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      await this.categoryService.remove(category.id);
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getArticlesByCategory)
  getArticlesByCategory(): unknown {
    return tsRestHandler(contract.getArticlesByCategory, async ({ params }) => {
      const category = await this.categoryService.findByName(params.name);
      if (!category) {
        throw new NotFoundException(`Category ${params.name} not found`);
      }
      const result = await this.categoryService.getArticlesByCategoryId(category.id, {
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
          category,
          tags: undefined,
          views,
          likes: 0,
          isTop: top > 0,
          isHot: false,
          pubTime: t.updatedAt,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          private: t.private ?? false,
          password,
          toc: undefined,
        };
      });
      return { status: 200, body: items };
    });
  }
}
