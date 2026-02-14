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
import { z } from 'zod';

import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { ArticleListResponseSchema, ArticleQuerySchema } from '../article/dto/article.dto';
import { Permission } from '../auth/permissions.decorator';

import { TagListResponseSchema, CreateTagSchema, UpdateTagSchema } from './dto/tag.dto';
import { Tag } from './entities/tag.entity';
import { TagService } from './tag.service';

/**
 * 标签管理控制器
 *
 * 提供标签的完整 CRUD 操作，包括创建、查询、更新、删除标签。
 * 支持标签统计信息和标签与分类的关联查询功能。
 */
@ApiTags('Tags')
@Controller({ path: 'tags', version: '2' })
export class TagController {
  constructor(private readonly tagService: TagService) {}

  /**
   * 获取所有标签
   *
   * 查询系统中的所有标签列表，包含标签的基本信息和使用统计。
   *
   * @returns 标签列表响应数据
   */
  @Get()
  @ApiOperation({ summary: 'Get all tags' })
  @ApiResponse({ status: 200, description: 'Return all tags' })
  async findAll(): Promise<z.infer<typeof TagListResponseSchema>> {
    return this.tagService.findAll();
  }

  /**
   * 根据 ID 获取标签
   *
   * 根据标签 ID 查询单个标签的详细信息。
   *
   * @param id 标签 ID
   * @returns 标签详细信息
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  @ApiResponse({ status: 200, description: 'Return tag by ID' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Tag> {
    return this.tagService.findOne(id);
  }

  /**
   * 创建新标签
   *
   * 创建一个新的标签，用于文章分类和组织。
   *
   * @param createTagDto 标签创建数据
   * @returns 创建的标签信息
   */
  @Post()
  @Permission('tag', ['create'])
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiResponse({ status: 201, description: 'Create new tag' })
  async create(@Body() raw: unknown): Promise<Tag> {
    const dto = CreateTagSchema.parse(raw);
    return this.tagService.create(dto);
  }

  /**
   * 更新标签
   *
   * 根据标签 ID 更新标签的信息，如名称、描述等。
   *
   * @param id 标签 ID
   * @param updateTagDto 标签更新数据
   * @returns 更新后的标签信息
   */
  @Put(':id')
  @Permission('tag', ['update'])
  @ApiOperation({ summary: 'Update a tag' })
  @ApiResponse({ status: 200, description: 'Update existing tag' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() raw: unknown): Promise<Tag> {
    const dto = UpdateTagSchema.parse(raw);
    return this.tagService.update(id, dto);
  }

  /**
   * 删除标签
   *
   * 根据标签 ID 删除指定标签。删除前会检查标签是否被文章使用。
   *
   * @param id 标签 ID
   */
  @Delete(':id')
  @Permission('tag', ['delete'])
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 200, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tagService.remove(id);
  }

  /**
   * 获取整体统计信息
   *
   * 获取标签和分类的整体统计数据，包括总数、使用情况等。
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
    return this.tagService.getStatistics();
  }

  /**
   * 获取标签与分类的关联信息
   *
   * 查询所有标签及其关联的分类信息，显示标签在不同分类中的使用情况。
   *
   * @returns 标签与分类的关联数据列表
   */
  @Get('associations/categories')
  @ApiOperation({ summary: 'Get tags with their associated categories' })
  @ApiResponse({
    status: 200,
    description: 'Tags with categories retrieved successfully',
  })
  async getTagsWithCategories(): Promise<
    {
      tag: Tag;
      categories: { name: string; count: number }[];
    }[]
  > {
    return this.tagService.getTagsWithCategories();
  }

  /**
   * 根据标签 ID 获取文章列表
   *
   * 根据标签 ID 查询该标签下的所有文章，支持分页和筛选。
   *
   * @param id 标签 ID
   * @param query 查询参数
   * @returns 文章列表响应数据
   */
  @Get(':id/articles')
  @ApiOperation({ summary: 'Get articles by tag ID' })
  @ApiResponse({ status: 200, description: 'Return articles by tag ID' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async getArticlesByTagId(
    @Param('id', ParseIntPipe) id: number,
    @Query() raw: unknown,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw ?? {});
    return this.tagService.getArticlesByTagId(id, query);
  }
}
