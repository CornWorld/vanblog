import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArticleService } from './article.service';
import {
  ArticleDto,
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  ArticleListResponseDto,
  ArticleSearchDto,
  ArticleSearchResponseDto,
} from './dto/article.dto';
import { RequireAuth } from '../auth/auth.decorator';

@ApiTags('articles')
@Controller('api/v2/articles')
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  @ApiOperation({ summary: 'Get all articles' })
  @ApiResponse({ status: 200, description: 'Return all articles', type: ArticleListResponseDto })
  async findAll(@Query() query: ArticleQueryDto): Promise<ArticleListResponseDto> {
    const articles = await this.articleService.findAll(query);
    return articles;
  }

  @Get('search')
  @ApiOperation({ summary: 'Search articles' })
  @ApiResponse({
    status: 200,
    description: 'Return search results',
    type: ArticleSearchResponseDto,
  })
  async search(@Query() query: ArticleSearchDto): Promise<ArticleSearchResponseDto> {
    return this.articleService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Return article by ID', type: ArticleDto })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ArticleDto> {
    return this.articleService.findOne(id);
  }

  @Post()
  @RequireAuth()
  @ApiOperation({ summary: 'Create article' })
  @ApiResponse({ status: 201, description: 'Create new article', type: ArticleDto })
  async create(@Body() createArticleDto: CreateArticleDto): Promise<ArticleDto> {
    return this.articleService.create(createArticleDto);
  }

  @Put(':id')
  @RequireAuth()
  @ApiOperation({ summary: 'Update article' })
  @ApiResponse({ status: 200, description: 'Update existing article', type: ArticleDto })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
  ): Promise<ArticleDto> {
    return this.articleService.update(id, updateArticleDto);
  }

  @Delete(':id')
  @RequireAuth()
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 200, description: 'Article deleted successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.articleService.remove(id);
  }
}
