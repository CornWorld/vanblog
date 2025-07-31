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
  Ip,
  Headers,
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
import { ArticleStatsService } from '../analytics/services/article-stats.service';

@ApiTags('articles')
@Controller('api/v2/articles')
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleStatsService: ArticleStatsService,
  ) {}

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

  @Get('export')
  @RequireAuth()
  @ApiOperation({ summary: 'Export all articles' })
  @ApiResponse({ status: 200, description: 'Export articles', type: [ArticleDto] })
  async export(): Promise<ArticleDto[]> {
    const articles = await this.articleService.exportArticles();
    return articles;
  }

  @Get('category/:name')
  @ApiOperation({ summary: 'Get articles by category name' })
  @ApiResponse({
    status: 200,
    description: 'Return articles by category',
    type: ArticleListResponseDto,
  })
  async findByCategory(@Param('name') name: string): Promise<ArticleListResponseDto> {
    return this.articleService.findByCategory(name);
  }

  @Post('import')
  @RequireAuth()
  @ApiOperation({ summary: 'Import articles' })
  @ApiResponse({ status: 201, description: 'Import articles' })
  async import(@Body() articles: CreateArticleDto[]): Promise<void> {
    await this.articleService.importArticles(articles);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Return article by ID', type: ArticleDto })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ArticleDto> {
    return this.articleService.findOne(id);
  }

  @Post(':id/view')
  @ApiOperation({ summary: 'Increment article view count by ID' })
  @ApiResponse({ status: 200, description: 'View count incremented' })
  async incrementView(
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.articleStatsService.recordArticleView(id, ip, userAgent);
  }

  @Post('pathname/:pathname/view')
  @ApiOperation({ summary: 'Increment article view count by pathname' })
  @ApiResponse({ status: 200, description: 'View count incremented' })
  async incrementViewByPathname(
    @Param('pathname') pathname: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.articleStatsService.recordArticleViewByPathname(pathname, ip, userAgent);
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
