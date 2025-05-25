import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { config } from '../../../common/config';
import { CreateArticleDto, UpdateArticleDto } from 'src/types/article/article.dto';
import { SortOrder } from 'src/types/sort';
import { ArticleProvider } from '../provider/article.provider';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { PipelineProvider } from '../provider/pipeline.provider';
import { ApiToken } from 'src/common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('article')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/article')
export class ArticleController {
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly isrProvider: ISRProvider,
    private readonly pipelineProvider: PipelineProvider,
  ) { }

  @Get('/')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('regMatch') regMatch = true,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('title') title?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('sortTop') sortTop?: SortOrder,
    @Query('sortViewer') sortViewer?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page: parseInt(page as any),
      pageSize: parseInt(pageSize as any),
      category,
      tags,
      title,
      sortCreatedAt,
      sortTop,
      startTime,
      endTime,
      toListView,
      regMatch,
      sortViewer,
    };
    const data = await this.articleProvider.getByOption(option, false);
    return Result.ok(data).toObject();
  }

  @Get('/:id')
  async getOneByIdOrPathname(@Param('id') id: string) {
    const data = await this.articleProvider.getByIdOrPathname(id, 'admin');
    return Result.ok(data).toObject();
  }

  @Put('/:id')
  async update(@Param('id') id: number, @Body() updateDto: UpdateArticleDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止修改文章！').toObject()
    }
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateArticle', updateDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        updateDto = lastOuput;
      }
    }
    const data = await this.articleProvider.updateById(id, updateDto);
    this.isrProvider.activeAll('更新文章触发增量渲染！', undefined, {
      postId: id,
    });
    const updatedArticle = await this.articleProvider.getById(id, 'admin');
    this.pipelineProvider.dispatchEvent('afterUpdateArticle', updatedArticle);
    return Result.ok(data).toObject();
  }

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateArticleDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止创建文章！').toObject()
    }
    const author = req?.user?.nickname || undefined;
    if (!createDto.author) {
      createDto.author = author;
    }
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateArticle', createDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        createDto = lastOuput;
      }
    }
    const data = await this.articleProvider.create(createDto);
    this.isrProvider.activeAll('创建文章触发增量渲染！', undefined, {
      postId: data.id,
    });
    this.pipelineProvider.dispatchEvent('afterUpdateArticle', data);
    return Result.ok(data).toObject();
  }
  @Post('searchByLink')
  async searchArtcilesByLink(@Body() searchDto: { link: string }) {
    const data = await this.articleProvider.searchArticlesByLink(searchDto?.link || '');
    return Result.ok(data).toObject();
  }
  @Delete('/:id')
  async delete(@Param('id') id: number) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止删除文章！').toObject()
    }
    const toDeleteArticle = await this.articleProvider.getById(id, 'admin');
    this.pipelineProvider.dispatchEvent('deleteArticle', toDeleteArticle);

    const data = await this.articleProvider.deleteById(id);
    this.isrProvider.activeAll('删除文章触发增量渲染！', undefined, {
      postId: id,
    });
    return Result.ok(data).toObject();
  }
}
