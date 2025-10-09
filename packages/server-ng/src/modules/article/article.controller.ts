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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';

import { ArticleStatsService } from '../analytics/services/article-stats.service';
import { Permission } from '../auth/permissions.decorator';
import { User } from '../user/entities/user.entity';

import { ArticleService } from './article.service';
import { RequireArticleAccess } from './decorators/article-access.decorator';
import { SkipArticleAccess } from './decorators/skip-article-access.decorator';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  ArticleListResponseDto,
  ArticleSearchDto,
  ArticleSearchResponseDto,
  CreateArticleSchema,
  UpdateArticleSchema,
} from './dto/article.dto';
import { VerifyArticlePasswordDto, ArticleAccessResponseDto } from './dto/verify-password.dto';
import { Article } from './entities/article.entity';
import { ArticleAccessGuard } from './guards/article-access.guard';

/**
 * 文章控制器
 *
 * 提供文章的 CRUD 操作、搜索、分类查询等功能。
 * 支持文章访问控制，包括密码保护和私有文章访问。
 */
@ApiTags('Articles')
@Controller({ path: 'articles', version: '2' })
@UseGuards(ArticleAccessGuard)
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    private readonly articleStatsService: ArticleStatsService,
  ) {}

  /**
   * 获取所有文章
   *
   * 支持分页、排序、筛选等查询参数。
   *
   * @param query 查询参数
   * @returns 文章列表和分页信息
   */
  @Get()
  @ApiOperation({ summary: 'Get all articles' })
  @ApiResponse({ status: 200, description: 'Return all articles' })
  async findAll(@Query() query: ArticleQueryDto): Promise<ArticleListResponseDto> {
    return this.articleService.findAll(query);
  }

  /**
   * 搜索文章
   *
   * 根据关键词搜索文章标题和内容。
   *
   * @param query 搜索参数
   * @returns 搜索结果
   */
  @Get('search')
  @ApiOperation({ summary: 'Search articles' })
  @ApiResponse({
    status: 200,
    description: 'Return search results',
  })
  async search(@Query() query: ArticleSearchDto): Promise<ArticleSearchResponseDto> {
    return this.articleService.search(query);
  }

  /**
   * 导出所有文章
   *
   * 导出系统中的所有文章数据，需要管理员权限。
   *
   * @returns 所有文章数据
   */
  @Get('export')
  @Permission('article', ['read'])
  @ApiOperation({ summary: 'Export all articles' })
  @ApiResponse({ status: 200, description: 'Export articles' })
  async export(): Promise<Article[]> {
    return this.articleService.exportArticles();
  }

  /**
   * 根据分类名称获取文章
   *
   * 获取指定分类下的所有文章。
   *
   * @param name 分类名称
   * @returns 该分类下的文章列表
   */
  @Get('category/:name')
  @ApiOperation({ summary: 'Get articles by category name' })
  @ApiResponse({
    status: 200,
    description: 'Return articles by category',
  })
  async findByCategory(@Param('name') name: string): Promise<ArticleListResponseDto> {
    return this.articleService.findByCategory(name);
  }

  /**
   * 批量导入文章
   *
   * 批量创建多篇文章，需要管理员权限。
   *
   * @param articles 文章数据数组
   */
  @Post('import')
  @Permission('article', ['create'])
  @ApiOperation({ summary: 'Import articles' })
  @ApiResponse({ status: 201, description: 'Import articles' })
  async import(@Body() articles: CreateArticleDto[]): Promise<void> {
    await this.articleService.importArticles(articles);
  }

  /**
   * 根据路径获取文章
   *
   * 根据文章的路径名称获取文章详情。如果文章是私有的，需要提供有效的访问令牌。
   *
   * @param pathname 文章路径名称
   * @returns 文章详情
   * @throws {NotFoundException} 当文章不存在时
   */
  @Get('by-path/:pathname')
  @RequireArticleAccess()
  @ApiOperation({ summary: 'Get article by pathname' })
  @ApiResponse({ status: 200, description: 'Return article by pathname' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 401, description: 'Article access token required for private articles' })
  async findOneByPathname(@Param('pathname') pathname: string): Promise<Article> {
    return this.articleService.findOneByPathname(pathname);
  }

  /**
   * 获取按分类分组的文章
   * 返回 Record<string, Article[]> 格式，用于前端展示
   */
  @Get('grouped-by-category')
  @SkipArticleAccess()
  @ApiOperation({ summary: 'Get articles grouped by category' })
  @ApiResponse({
    status: 200,
    description: 'Return articles grouped by category name',
  })
  async getArticlesGroupedByCategory(): Promise<Record<string, Article[]>> {
    return this.articleService.getArticlesGroupedByCategory();
  }

  /**
   * 获取按标签分组的文章
   * 返回 Record<string, Article[]> 格式，用于前端展示
   */
  @Get('grouped-by-tag')
  @SkipArticleAccess()
  @ApiOperation({ summary: 'Get articles grouped by tag' })
  @ApiResponse({
    status: 200,
    description: 'Return articles grouped by tag name',
  })
  async getArticlesGroupedByTag(): Promise<Record<string, Article[]>> {
    return this.articleService.getArticlesGroupedByTag();
  }

  /**
   * 根据 ID 获取文章
   *
   * 根据文章 ID 获取文章的详细信息。
   *
   * @param id 文章 ID
   * @returns 文章详细信息
   * @throws {NotFoundException} 当文章不存在时
   */
  @Get(':id')
  @RequireArticleAccess()
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiResponse({ status: 200, description: 'Return article by ID' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 401, description: 'Article access token required for private articles' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Article> {
    return this.articleService.findOne(id);
  }

  /**
   * 增加文章浏览量（通过 ID）
   *
   * 记录文章的浏览行为，增加浏览计数并记录访问统计信息。
   *
   * @param id 文章 ID
   * @param ip 访问者 IP 地址
   * @param userAgent 用户代理字符串
   */
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

  /**
   * 增加文章浏览量（通过路径）
   *
   * 根据文章路径记录浏览行为，增加浏览计数并记录访问统计信息。
   *
   * @param pathname 文章路径名称
   * @param ip 访问者 IP 地址
   * @param userAgent 用户代理字符串
   */
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

  /**
   * 创建新文章
   *
   * 创建一篇新的文章，需要管理员权限。
   *
   * @param createArticleDto 文章创建数据
   * @returns 创建的文章
   */
  @Post()
  @Permission('article', ['create'])
  @ApiOperation({ summary: 'Create article' })
  @ApiResponse({ status: 201, description: 'Create new article' })
  async create(
    @Body(new ZodValidationPipe(CreateArticleSchema)) createArticleDto: CreateArticleDto,
  ): Promise<Article> {
    return this.articleService.create(createArticleDto);
  }

  /**
   * 更新文章
   *
   * 根据 ID 更新文章信息，需要管理员权限。
   *
   * @param id 文章 ID
   * @param updateArticleDto 文章更新数据
   * @returns 更新后的文章
   * @throws {NotFoundException} 当文章不存在时
   */
  @Put(':id')
  @Permission('article', ['update'])
  @ApiOperation({ summary: 'Update article' })
  @ApiResponse({ status: 200, description: 'Update existing article' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateArticleSchema)) updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    return this.articleService.update(id, updateArticleDto);
  }

  /**
   * 删除文章
   *
   * 根据 ID 删除文章，需要管理员权限。
   *
   * @param id 文章 ID
   * @throws {NotFoundException} 当文章不存在时
   */
  @Delete(':id')
  @Permission('article', ['delete'])
  @ApiOperation({ summary: 'Delete article' })
  @ApiResponse({ status: 200, description: 'Article deleted successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.articleService.remove(id);
  }

  /**
   * 验证文章密码（通过 ID）
   *
   * 验证受密码保护文章的访问密码，成功后返回访问令牌。
   *
   * @param id 文章 ID
   * @param verifyPasswordDto 密码验证数据
   * @param req 请求对象，包含用户信息
   * @returns 访问令牌信息
   * @throws {UnauthorizedException} 当密码错误时
   * @throws {NotFoundException} 当文章不存在时
   */
  @Post(':id/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify article password' })
  @ApiParam({ name: 'id', description: 'Article ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: ArticleAccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async verifyPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() verifyPasswordDto: VerifyArticlePasswordDto,
    @Request() req: { user?: User },
  ): Promise<ArticleAccessResponseDto> {
    return this.articleService.verifyPassword(id, verifyPasswordDto.password, req.user?.id);
  }

  /**
   * 验证文章密码（通过路径）
   *
   * 根据文章路径验证受密码保护文章的访问密码，成功后返回访问令牌。
   *
   * @param pathname 文章路径名称
   * @param verifyPasswordDto 密码验证数据
   * @param req 请求对象，包含用户信息
   * @returns 访问令牌信息
   * @throws {UnauthorizedException} 当密码错误时
   * @throws {NotFoundException} 当文章不存在时
   */
  @Post('by-path/:pathname/verify-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify article password by pathname' })
  @ApiParam({ name: 'pathname', description: 'Article pathname', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Password verified successfully',
    type: ArticleAccessResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async verifyPasswordByPathname(
    @Param('pathname') pathname: string,
    @Body() verifyPasswordDto: VerifyArticlePasswordDto,
    @Request() req: { user?: User },
  ): Promise<ArticleAccessResponseDto> {
    return this.articleService.verifyPasswordByPathname(
      pathname,
      verifyPasswordDto.password,
      req.user?.id,
    );
  }
}
