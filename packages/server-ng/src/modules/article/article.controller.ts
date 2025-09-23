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
 * 文章管理控制器
 *
 * 提供文章的 CRUD 操作，包括创建、查询、更新和删除文章，
 * 以及文章搜索、导入导出、浏览量统计等功能。
 *
 * @author VanBlog Team
 * @since 2.0.0
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
   * 根据查询条件获取文章列表，支持分页、排序、筛选等功能。
   *
   * @param query 文章查询参数
   * @returns 文章列表响应对象
   */
  @Get()
  @ApiOperation({ summary: 'Get all articles' })
  @ApiResponse({ status: 200, description: 'Return all articles' })
  async findAll(@Query() query: ArticleQueryDto): Promise<ArticleListResponseDto> {
    const articles = await this.articleService.findAll(query);
    return articles;
  }

  /**
   * 搜索文章
   *
   * 根据关键词搜索文章，支持标题、内容、标签等多字段搜索。
   *
   * @param query 文章搜索参数
   * @returns 文章搜索结果
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
   * 导出系统中所有文章的完整数据，用于备份或迁移。需要文章读取权限。
   *
   * @returns 所有文章的数据数组
   */
  @Get('export')
  @Permission('article', ['read'])
  @ApiOperation({ summary: 'Export all articles' })
  @ApiResponse({ status: 200, description: 'Export articles' })
  async export(): Promise<Article[]> {
    const articles = await this.articleService.exportArticles();
    return articles;
  }

  /**
   * 根据分类名称获取文章
   *
   * 获取指定分类下的所有文章列表。
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
   * 导入文章
   *
   * 批量导入文章数据，用于数据迁移或批量创建。需要文章创建权限。
   *
   * @param articles 要导入的文章数据数组
   * @throws {BadRequestException} 当文章数据格式错误时
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
   * 根据文章的路径名称获取文章详细信息，用于前端路由访问。
   *
   * @param pathname 文章路径名称
   * @returns 文章详细信息
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
   * 根据提供的文章信息创建新文章。需要文章创建权限。
   *
   * @param createArticleDto 文章创建数据传输对象
   * @returns 创建成功的文章信息
   * @throws {BadRequestException} 当文章数据验证失败时
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
   * 更新文章信息
   *
   * 根据文章 ID 更新文章的信息，如标题、内容、分类、标签等。
   *
   * @param id 文章 ID
   * @param updateArticleDto 文章更新数据传输对象
   * @returns 更新后的文章信息
   * @throws {NotFoundException} 当文章不存在时
   * @throws {BadRequestException} 当数据验证失败时
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
   * 根据文章 ID 删除指定文章及其相关数据。
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
    return this.articleService.remove(id);
  }

  /**
   * 验证文章密码
   *
   * 验证受密码保护文章的访问密码。
   *
   * @param id 文章 ID
   * @param verifyPasswordDto 密码验证数据传输对象
   * @returns 文章访问响应
   * @throws {NotFoundException} 当文章不存在时
   * @throws {UnauthorizedException} 当密码错误时
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
    // 提取当前用户 ID（如果已认证）
    const userId = req.user?.id;
    return this.articleService.verifyPassword(id, verifyPasswordDto.password, userId);
  }

  /**
   * 验证文章密码（按 pathname）
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
    const userId = req.user?.id;
    return this.articleService.verifyPasswordByPathname(
      pathname,
      verifyPasswordDto.password,
      userId,
    );
  }
}
