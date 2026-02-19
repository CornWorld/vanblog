import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { z } from 'zod';

import { ArticleStatsService } from '../analytics/services/article-stats.service';
import { Permission } from '../auth/permissions.decorator';
import { User } from '../user/entities/user.entity';

import { ArticleService } from './article.service';
import { RequireArticleAccess } from './decorators/article-access.decorator';
import { SkipArticleAccess } from './decorators/skip-article-access.decorator';
import {
  ArticleListResponseSchema,
  ArticleQuerySchema,
  ArticleSearchResponseSchema,
  ArticleSearchSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
} from './dto/article.dto';
import {
  VerifyArticlePasswordSchema,
  ArticleAccessResponseSchema,
  ArticleAccessResponse,
} from './dto/verify-password.dto';
import { Article } from './entities/article.entity';
import { ArticleAccessGuard } from './guards/article-access.guard';

/**
 * 公共文章控制器 (VERSION_NEUTRAL)
 *
 * 提供无版本前缀的公共文章端点，与 root contract 路径对齐。
 * 路由: /api/articles/...
 */
@ApiTags('Articles (Public)')
@Controller({ path: 'articles', version: VERSION_NEUTRAL })
@UseGuards(ArticleAccessGuard)
export class PublicArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleStatsService: ArticleStatsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all articles (public)' })
  @ApiResponse({ status: 200, description: 'Return all articles' })
  async findAll(@Query() raw: unknown): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw ?? {});
    return this.articleService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search articles (public)' })
  @ApiResponse({ status: 200, description: 'Return search results' })
  async search(@Query() raw: unknown): Promise<z.infer<typeof ArticleSearchResponseSchema>> {
    const query = ArticleSearchSchema.parse(raw);
    return this.articleService.search(query);
  }

  @Get('category/:name')
  @ApiOperation({ summary: 'Get articles by category name (public)' })
  @ApiResponse({ status: 200, description: 'Return articles by category' })
  async findByCategory(
    @Param('name') name: string,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    return this.articleService.findByCategory(name);
  }

  @Get('by-path/:pathname')
  @RequireArticleAccess()
  @ApiOperation({ summary: 'Get article by pathname (public)' })
  @ApiResponse({ status: 200, description: 'Return article by pathname' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOneByPathname(@Param('pathname') pathname: string): Promise<Article> {
    return this.articleService.findOneByPathname(pathname);
  }

  @Get('grouped-by-category')
  @SkipArticleAccess()
  @ApiOperation({ summary: 'Get articles grouped by category (public)' })
  @ApiResponse({ status: 200, description: 'Return articles grouped by category name' })
  async getArticlesGroupedByCategory(): Promise<Record<string, Article[]>> {
    return this.articleService.getArticlesGroupedByCategory();
  }

  @Get('grouped-by-tag')
  @SkipArticleAccess()
  @ApiOperation({ summary: 'Get articles grouped by tag (public)' })
  @ApiResponse({ status: 200, description: 'Return articles grouped by tag name' })
  async getArticlesGroupedByTag(): Promise<Record<string, Article[]>> {
    return this.articleService.getArticlesGroupedByTag();
  }

  @Get(':id')
  @RequireArticleAccess()
  @ApiOperation({ summary: 'Get article by ID (public)' })
  @ApiResponse({ status: 200, description: 'Return article by ID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Article> {
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

  @Post(':id/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify article password' })
  @ApiParam({ name: 'id', description: 'Article ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: ArticleAccessResponse,
  })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async verifyPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() raw: unknown,
    @Request() req: { user?: User },
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    const dto = VerifyArticlePasswordSchema.parse(raw);
    return this.articleService.verifyPassword(id, dto.password, req.user?.id);
  }

  @Post('by-path/:pathname/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify article password by pathname' })
  @ApiParam({ name: 'pathname', description: 'Article pathname', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: ArticleAccessResponse,
  })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async verifyPasswordByPathname(
    @Param('pathname') pathname: string,
    @Body() raw: unknown,
    @Request() req: { user?: User },
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    const dto = VerifyArticlePasswordSchema.parse(raw);
    return this.articleService.verifyPasswordByPathname(pathname, dto.password, req.user?.id);
  }
}

/**
 * 管理文章控制器 (v2)
 *
 * 提供需要认证的文章管理端点。
 * 路由: /api/v2/articles/...
 */
@ApiTags('Articles (Admin)')
@Controller({ path: 'articles', version: '2' })
@UseGuards(ArticleAccessGuard)
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleStatsService: ArticleStatsService,
  ) {}

  /**
   * 获取所有文章（管理端，与公共端点共享，保持向后兼容）
   */
  @Get()
  @ApiOperation({ summary: 'Get all articles' })
  @ApiResponse({ status: 200, description: 'Return all articles' })
  async findAll(@Query() raw: unknown): Promise<z.infer<typeof ArticleListResponseSchema>> {
    const query = ArticleQuerySchema.parse(raw ?? {});
    return this.articleService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search articles' })
  @ApiResponse({ status: 200, description: 'Return search results' })
  async search(@Query() raw: unknown): Promise<z.infer<typeof ArticleSearchResponseSchema>> {
    const query = ArticleSearchSchema.parse(raw);
    return this.articleService.search(query);
  }

  @Get('export')
  @Permission('article', ['read'])
  @ApiOperation({ summary: 'Export all articles' })
  @ApiResponse({ status: 200, description: 'Export articles' })
  async export(): Promise<Article[]> {
    return this.articleService.exportArticles();
  }

  @Get('category/:name')
  @ApiOperation({ summary: 'Get articles by category name' })
  @ApiResponse({ status: 200, description: 'Return articles by category' })
  async findByCategory(
    @Param('name') name: string,
  ): Promise<z.infer<typeof ArticleListResponseSchema>> {
    return this.articleService.findByCategory(name);
  }

  @Post('import')
  @Permission('article', ['create'])
  @ApiOperation({ summary: 'Import articles' })
  @ApiResponse({ status: 201, description: 'Import articles' })
  async import(@Body() raw: unknown): Promise<void> {
    const articles = z.array(CreateArticleSchema).parse(raw);
    await this.articleService.importArticles(articles);
  }

  @Get('by-path/:pathname')
  @RequireArticleAccess()
  @ApiOperation({ summary: 'Get article by pathname' })
  @ApiResponse({ status: 200, description: 'Return article by pathname' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOneByPathname(@Param('pathname') pathname: string): Promise<Article> {
    return this.articleService.findOneByPathname(pathname);
  }

  @Get('grouped-by-category')
  @SkipArticleAccess()
  @ApiOperation({ summary: 'Get articles grouped by category' })
  @ApiResponse({ status: 200, description: 'Return articles grouped by category name' })
  async getArticlesGroupedByCategory(): Promise<Record<string, Article[]>> {
    return this.articleService.getArticlesGroupedByCategory();
  }

  @Get('grouped-by-tag')
  @SkipArticleAccess()
  @ApiOperation({ summary: 'Get articles grouped by tag' })
  @ApiResponse({ status: 200, description: 'Return articles grouped by tag name' })
  async getArticlesGroupedByTag(): Promise<Record<string, Article[]>> {
    return this.articleService.getArticlesGroupedByTag();
  }

  @Get(':id')
  @RequireArticleAccess()
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Return article by ID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Article> {
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
  @Permission('article', ['create'])
  @ApiOperation({ summary: 'Create article' })
  @ApiResponse({ status: 201, description: 'Create new article' })
  async create(@Body() raw: unknown): Promise<Article> {
    const dto = CreateArticleSchema.parse(raw);
    return this.articleService.create(dto);
  }

  @Put(':id')
  @Permission('article', ['update'])
  @ApiOperation({ summary: 'Update article' })
  @ApiResponse({ status: 200, description: 'Update existing article' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() raw: unknown): Promise<Article> {
    const dto = UpdateArticleSchema.parse(raw);
    return this.articleService.update(id, dto);
  }

  @Delete(':id')
  @Permission('article', ['delete'])
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 200, description: 'Article deleted successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.articleService.remove(id);
  }

  @Post(':id/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify article password' })
  @ApiParam({ name: 'id', description: 'Article ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: ArticleAccessResponse,
  })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async verifyPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() raw: unknown,
    @Request() req: { user?: User },
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    const dto = VerifyArticlePasswordSchema.parse(raw);
    return this.articleService.verifyPassword(id, dto.password, req.user?.id);
  }

  @Post('by-path/:pathname/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify article password by pathname' })
  @ApiParam({ name: 'pathname', description: 'Article pathname', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: ArticleAccessResponse,
  })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async verifyPasswordByPathname(
    @Param('pathname') pathname: string,
    @Body() raw: unknown,
    @Request() req: { user?: User },
  ): Promise<z.infer<typeof ArticleAccessResponseSchema>> {
    const dto = VerifyArticlePasswordSchema.parse(raw);
    return this.articleService.verifyPasswordByPathname(pathname, dto.password, req.user?.id);
  }
}
