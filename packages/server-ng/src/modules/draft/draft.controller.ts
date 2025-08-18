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
import { ZodValidationPipe } from 'nestjs-zod';

import { Article } from '../article/entities/article.entity';
import { Permission } from '../auth/permissions.decorator';

import { DraftVersionService } from './draft-version.service';
import { DraftService } from './draft.service';
import {
  DraftDto,
  CreateDraftDto,
  UpdateDraftDto,
  DraftListResponseDto,
  DraftQueryDto,
  PublishDraftDto,
  DraftVersionDto,
  DraftVersionListResponseDto,
  CreateDraftSchema,
  UpdateDraftSchema,
  PublishDraftSchema,
} from './dto/draft.dto';

/**
 * 草稿管理控制器
 *
 * 提供草稿的完整生命周期管理，包括创建、编辑、版本控制、
 * 自动保存、发布为文章等功能。支持草稿版本历史和恢复操作。
 */
@ApiTags('Drafts')
@Controller({ path: 'drafts', version: '2' })
export class DraftController {
  constructor(
    private readonly draftService: DraftService,
    private readonly draftVersionService: DraftVersionService,
  ) {}

  /**
   * 获取草稿列表
   *
   * 分页查询所有草稿，支持按标题、状态、创建时间等条件过滤。
   *
   * @param query 查询参数
   * @returns 分页的草稿列表
   */
  @Get()
  @Permission('draft', ['read'])
  @ApiOperation({ summary: 'Get all drafts' })
  @ApiResponse({ status: 200, description: 'Return all drafts' })
  async findAll(@Query() query: DraftQueryDto): Promise<DraftListResponseDto> {
    return this.draftService.findAll(query);
  }

  /**
   * 根据 ID 获取草稿
   *
   * 获取指定 ID 的草稿详细信息。
   *
   * @param id 草稿 ID
   * @returns 草稿详细信息
   */
  @Get(':id')
  @Permission('draft', ['read'])
  @ApiOperation({ summary: 'Get draft by ID' })
  @ApiResponse({ status: 200, description: 'Return draft by ID' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<DraftDto> {
    return this.draftService.findOne(id);
  }

  /**
   * 创建新草稿
   *
   * 创建一个新的草稿，包含标题、内容、标签等基本信息。
   *
   * @param createDraftDto 草稿创建数据
   * @returns 创建的草稿信息
   */
  @Post()
  @Permission('draft', ['create'])
  @ApiOperation({ summary: 'Create draft' })
  @ApiResponse({ status: 201, description: 'Create new draft' })
  async create(
    @Body(new ZodValidationPipe(CreateDraftSchema)) createDraftDto: CreateDraftDto,
  ): Promise<DraftDto> {
    return this.draftService.create(createDraftDto);
  }

  @Put(':id')
  @Permission('draft', ['update'])
  @ApiOperation({ summary: 'Update draft' })
  @ApiResponse({ status: 200, description: 'Update existing draft' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateDraftSchema)) updateDraftDto: UpdateDraftDto,
  ): Promise<DraftDto> {
    return this.draftService.update(id, updateDraftDto);
  }

  @Delete(':id')
  @Permission('draft', ['delete'])
  @ApiOperation({ summary: 'Delete draft' })
  @ApiResponse({ status: 200, description: 'Draft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.draftService.remove(id);
  }

  /**
   * 发布草稿为文章
   *
   * 将草稿发布为正式文章，可以指定发布时间、分类等额外信息。
   *
   * @param id 草稿 ID
   * @param publishDto 发布配置
   * @returns 发布的文章信息
   */
  @Post(':id/publish')
  @Permission('draft', ['publish'])
  @ApiOperation({ summary: 'Publish draft as article' })
  @ApiResponse({ status: 200, description: 'Draft published successfully', type: Article })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async publish(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(PublishDraftSchema)) publishDto: PublishDraftDto,
  ): Promise<Article> {
    return this.draftService.publish(id, publishDto);
  }

  @Post('import')
  @Permission('draft', ['create'])
  @ApiOperation({ summary: 'Import multiple drafts' })
  @ApiResponse({ status: 200, description: 'Drafts imported successfully' })
  async importDrafts(@Body() draftDtos: CreateDraftDto[]): Promise<void> {
    return this.draftService.importDrafts(draftDtos);
  }

  /**
   * 自动保存草稿
   *
   * 定期自动保存草稿内容，防止数据丢失。与手动保存不同，
   * 自动保存不会创建新的版本记录。
   *
   * @param id 草稿 ID
   * @param updateDraftDto 更新的草稿数据
   * @returns 更新后的草稿信息
   */
  @Put(':id/auto-save')
  @Permission('draft', ['update'])
  @ApiOperation({ summary: 'Auto-save draft' })
  @ApiResponse({ status: 200, description: 'Draft auto-saved successfully' })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async autoSave(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDraftDto: UpdateDraftDto,
  ): Promise<DraftDto> {
    return this.draftService.autoSave(id, updateDraftDto);
  }

  /**
   * 获取草稿版本历史
   *
   * 获取指定草稿的所有版本历史记录，包括版本号、创建时间、
   * 修改摘要等信息。
   *
   * @param id 草稿 ID
   * @returns 草稿版本列表
   */
  @Get(':id/versions')
  @Permission('draft', ['read'])
  @ApiOperation({ summary: 'Get draft versions' })
  @ApiResponse({
    status: 200,
    description: 'Return draft versions',
  })
  @ApiResponse({ status: 404, description: 'Draft not found' })
  async getVersions(@Param('id', ParseIntPipe) id: number): Promise<DraftVersionListResponseDto> {
    const versions = await this.draftVersionService.getVersions(id);
    return {
      items: versions,
      total: versions.length,
      page: 1,
      pageSize: versions.length,
      totalPages: 1,
    };
  }

  @Get(':id/versions/:version')
  @Permission('draft', ['read'])
  @ApiOperation({ summary: 'Get specific draft version' })
  @ApiResponse({ status: 200, description: 'Return draft version' })
  @ApiResponse({ status: 404, description: 'Draft version not found' })
  async getVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<DraftVersionDto> {
    return this.draftVersionService.getVersion(id, version);
  }

  /**
   * 恢复草稿到指定版本
   *
   * 将草稿内容恢复到历史版本的状态，当前内容将被覆盖。
   * 恢复操作会创建一个新的版本记录。
   *
   * @param id 草稿 ID
   * @param version 目标版本号
   */
  @Post(':id/versions/:version/restore')
  @Permission('draft', ['update'])
  @ApiOperation({ summary: 'Restore draft to specific version' })
  @ApiResponse({ status: 200, description: 'Draft restored successfully' })
  @ApiResponse({ status: 404, description: 'Draft version not found' })
  async restoreVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<void> {
    return this.draftVersionService.restoreVersion(id, version);
  }

  @Delete(':id/versions/:version')
  @Permission('draft', ['delete'])
  @ApiOperation({ summary: 'Delete draft version' })
  @ApiResponse({ status: 200, description: 'Draft version deleted successfully' })
  @ApiResponse({ status: 404, description: 'Draft version not found' })
  async deleteVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<void> {
    return this.draftVersionService.deleteVersion(id, version);
  }
}
