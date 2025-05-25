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
import { ApiTags } from '@nestjs/swagger';
import { CreateDraftDto, PublishDraftDto, UpdateDraftDto } from 'src/types/article/draft.dto';
import { SortOrder } from 'src/types/sort';
import { AdminGuard } from '../../auth/guard/auth.guard';
import { DraftProvider } from '../provider/draft.provider';
import { ISRProvider } from '../../isr/provider/isr.provider';
import { config } from 'src/common/config';
import { PipelineProvider } from '../provider/pipeline.provider';
import { ApiToken } from 'src/common/swagger/token';
import { Result } from 'src/common/result/Result';

@ApiTags('draft')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/draft')
export class DraftController {
  constructor(
    private readonly draftProvider: DraftProvider,
    private readonly isrProvider: ISRProvider,
    private readonly pipelineProvider: PipelineProvider,
  ) { }

  @Get('/')
  async getByOption(
    @Query('page') page: number,
    @Query('pageSize') pageSize = 5,
    @Query('toListView') toListView = false,
    @Query('category') category?: string,
    @Query('tags') tags?: string,
    @Query('title') title?: string,
    @Query('sortCreatedAt') sortCreatedAt?: SortOrder,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const option = {
      page,
      pageSize,
      category,
      tags,
      title,
      sortCreatedAt,
      startTime,
      endTime,
      toListView,
    };
    const data = await this.draftProvider.getByOption(option);
    return Result.ok(data).toObject();
  }

  @Get('/:id')
  async getOne(@Param('id') id: number) {
    const data = await this.draftProvider.findById(id);
    return Result.ok(data).toObject();
  }

  @Put('/:id')
  async update(@Param('id') id: number, @Body() updateDto: UpdateDraftDto) {
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateDraft', updateDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        updateDto = lastOuput;
      }
    }
    const data = await this.draftProvider.updateById(id, updateDto);
    const updated = await this.draftProvider.findById(id);
    this.pipelineProvider.dispatchEvent('afterUpdateDraft', updated);
    return Result.ok(data).toObject();
  }

  @Post()
  async create(@Req() req: any, @Body() createDto: CreateDraftDto) {
    const author = req?.user?.nickname || undefined;
    if (!createDto.author) {
      createDto.author = author;
    }
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateDraft', createDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        createDto = lastOuput;
      }
    }
    const data = await this.draftProvider.create(createDto);
    this.pipelineProvider.dispatchEvent('afterUpdateDraft', data);
    return Result.ok(data).toObject();
  }
  @Post('/publish')
  async publish(@Query('id') id: number, @Body() publishDto: PublishDraftDto) {
    if (config.demo && config.demo == 'true') {
      return Result.build(401, '演示站禁止发布草稿！').toObject();
    }
    const result = await this.pipelineProvider.dispatchEvent('beforeUpdateArticle', publishDto);
    if (result.length > 0) {
      const lastResult = result[result.length - 1];
      const lastOuput = lastResult.output;
      if (lastOuput) {
        publishDto = lastOuput;
      }
    }
    const data = await this.draftProvider.publish(id, publishDto);
    this.isrProvider.activeAll('发布草稿触发增量渲染！');
    this.pipelineProvider.dispatchEvent('afterUpdateArticle', data);
    return Result.ok(data).toObject();
  }
  @Delete('/:id')
  async delete(@Param('id') id: number) {
    const toDeleteDraft = await this.draftProvider.findById(id);
    const data = await this.draftProvider.deleteById(id);
    this.pipelineProvider.dispatchEvent('deleteDraft', toDeleteDraft);
    return Result.ok(data).toObject();
  }
}
