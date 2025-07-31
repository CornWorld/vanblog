import { Body, Controller, Delete, Get, Param, Post, Put, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import {
  CategoryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryListResponseDto,
} from './dto/category.dto';
import { Category } from './entities/category.entity';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { VerifyCategoryPasswordDto, CategoryAccessResponseDto } from './dto/verify-password.dto';
import { RequireAuth } from '../auth/auth.decorator';

@ApiTags('categories')
@Controller('api/v2/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'Return all categories', type: CategoryListResponseDto })
  async findAll(): Promise<CategoryListResponseDto> {
    return this.categoryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Return category by ID', type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CategoryDto> {
    return this.categoryService.findOne(id);
  }

  @Post()
  @RequireAuth()
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, description: 'Create new category', type: CategoryDto })
  async create(@Body() createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoryService.create(createCategoryDto);
  }

  @Put(':id')
  @RequireAuth()
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Update existing category', type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @RequireAuth()
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
    type: CategoryAccessResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async verifyPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() verifyPasswordDto: VerifyCategoryPasswordDto,
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
