import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import {
  ArticleListResponseDto,
  ArticleQueryDto,
  ArticleQuerySchema,
} from '../article/dto/article.dto';
import { Permission } from '../auth/permissions.decorator';

import { CategoryService } from './category.service';
import {
  CategoryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryListResponseDto,
  CreateCategorySchema,
  UpdateCategorySchema,
} from './dto/category.dto';
import {
  VerifyCategoryPasswordDto,
  CategoryAccessResponseDto,
  CategoryAccessResponse,
  VerifyCategoryPasswordSchema,
} from './dto/verify-password.dto';
import { Category } from './entities/category.entity';

/**
 * 分类管理控制器
 *
 * 提供分类的 CRUD 操作，包括创建、查询、更新和删除分类，
 * 以及分类密码验证、统计信息获取等功能。
 *
 * @author VanBlog Team
 * @since 2.0.0
 */
@ApiTags('Categories')
@Controller({ path: 'categories', version: '2' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * 获取所有分类
   *
   * 查询系统中所有分类的信息列表，包括分类的基本信息和文章数量。
   *
   * @returns 分类列表响应对象
   */
  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Return all categories' })
  async findAll(): Promise<CategoryListResponseDto> {
    return this.categoryService.findAll();
  }

  /**
   * 根据 ID 获取分类
   *
   * 根据分类 ID 查询单个分类的详细信息。
   *
   * @param id 分类 ID
   * @returns 分类详细信息
   * @throws {NotFoundException} 当分类不存在时
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Return category by ID' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CategoryDto> {
    return this.categoryService.findOne(id);
  }

  /**
   * 创建新分类
   *
   * 根据提供的分类信息创建新的分类。需要分类创建权限。
   *
   * @param createCategoryDto 分类创建数据传输对象
   * @returns 创建成功的分类信息
   * @throws {BadRequestException} 当分类名称已存在或数据验证失败时
   */
  @Post()
  @Permission('category', ['create'])
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, description: 'Create new category' })
  async create(
    @Body(new ZodValidationPipe(CreateCategorySchema)) createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoryService.create(createCategoryDto);
  }

  /**
   * 更新分类信息
   *
   * 根据分类 ID 更新分类的信息，如名称、描述、密码等。
   *
   * @param id 分类 ID
   * @param updateCategoryDto 分类更新数据传输对象
   * @returns 更新后的分类信息
   * @throws {NotFoundException} 当分类不存在时
   * @throws {BadRequestException} 当数据验证失败时
   */
  @Put(':id')
  @Permission('category', ['update'])
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Update existing category' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  /**
   * 删除分类
   *
   * 根据分类 ID 删除指定分类。删除前会检查分类下是否有文章。
   *
   * @param id 分类 ID
   * @throws {NotFoundException} 当分类不存在时
   * @throws {BadRequestException} 当分类下还有文章时
   */
  @Delete(':id')
  @Permission('category', ['delete'])
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoryService.remove(id);
  }

  /**
   * 获取整体统计信息
   *
   * 获取分类和标签的整体统计信息，包括总数量、文章分布等。
   *
   * @returns 整体统计信息
   */
  @Get('statistics/overall')
  @ApiOperation({ summary: 'Get overall statistics for categories and tags' })
  @ApiResponse({
    status: 200,
    description: 'Overall statistics retrieved successfully',
    type: OverallStatisticsDto,
  })
  async getStatistics(): Promise<OverallStatisticsDto> {
    return this.categoryService.getStatistics();
  }

  /**
   * 验证分类密码
   *
   * 验证私有分类的访问密码，用于控制分类内容的访问权限。
   *
   * @param id 分类 ID
   * @param verifyPasswordDto 密码验证数据传输对象
   * @returns 密码验证结果
   * @throws {NotFoundException} 当分类不存在时
   * @throws {BadRequestException} 当密码错误时
   */
  @Post(':id/verify-password')
  @ApiOperation({ summary: 'Verify password for a private category' })
  @ApiResponse({
    status: 200,
    description: 'Password verification result',
    type: CategoryAccessResponse,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async verifyPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(VerifyCategoryPasswordSchema))
    verifyPasswordDto: VerifyCategoryPasswordDto,
  ): Promise<CategoryAccessResponseDto> {
    return this.categoryService.verifyPassword(id, verifyPasswordDto.password);
  }

  /**
   * 获取分类及其关联标签
   *
   * 获取所有分类及其关联的标签信息，包括每个标签的使用次数。
   *
   * @returns 分类及其关联标签的列表
   */
  @Get('associations/tags')
  @ApiOperation({ summary: 'Get categories with their associated tags' })
  @ApiResponse({
    status: 200,
    description: 'Categories with tags retrieved successfully',
  })
  async getCategoriesWithTags(): Promise<
    {
      category: Category;
      tags: { name: string; count: number }[];
    }[]
  > {
    return this.categoryService.getCategoriesWithTags();
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
    @Query(new ZodValidationPipe(ArticleQuerySchema)) query: ArticleQueryDto,
  ): Promise<ArticleListResponseDto> {
    return this.categoryService.getArticlesByCategoryId(id, query);
  }
}
