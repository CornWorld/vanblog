import { Body, Controller, Delete, Get, Param, Post, Put, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
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

@ApiTags('Categories')
@Controller({ path: 'categories', version: '2' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Return all categories' })
  async findAll(): Promise<CategoryListResponseDto> {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Return category by ID' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CategoryDto> {
    return this.categoryService.findOne(id);
  }

  @Post()
  @Permission('category', ['create'])
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, description: 'Create new category' })
  async create(
    @Body(new ZodValidationPipe(CreateCategorySchema)) createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoryService.create(createCategoryDto);
  }

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

  @Delete(':id')
  @Permission('category', ['delete'])
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.categoryService.remove(id);
  }

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
}
