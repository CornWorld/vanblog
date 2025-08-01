import { Body, Controller, Delete, Get, Param, Post, Put, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TagService } from './tag.service';
import { CreateTagDto, UpdateTagDto, TagListResponseDto } from './dto/tag.dto';
import { Tag } from './entities/tag.entity';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { RequireAuth } from '../auth/auth.decorator';

@ApiTags('tags')
@Controller('api/v2/tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tags' })
  @ApiResponse({ status: 200, description: 'Return all tags' })
  async findAll(): Promise<TagListResponseDto> {
    return this.tagService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tag by ID' })
  @ApiResponse({ status: 200, description: 'Return tag by ID' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Tag> {
    return this.tagService.findOne(id);
  }

  @Post()
  @RequireAuth()
  @ApiOperation({ summary: 'Create tag' })
  @ApiResponse({ status: 201, description: 'Create new tag' })
  async create(@Body() createTagDto: CreateTagDto): Promise<Tag> {
    return this.tagService.create(createTagDto);
  }

  @Put(':id')
  @RequireAuth()
  @ApiOperation({ summary: 'Update tag' })
  @ApiResponse({ status: 200, description: 'Update existing tag' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTagDto: UpdateTagDto,
  ): Promise<Tag> {
    return this.tagService.update(id, updateTagDto);
  }

  @Delete(':id')
  @RequireAuth()
  @ApiOperation({ summary: 'Delete tag' })
  @ApiResponse({ status: 200, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.tagService.remove(id);
  }

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
}
