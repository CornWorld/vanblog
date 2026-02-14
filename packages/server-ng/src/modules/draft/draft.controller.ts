import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';

import { Article } from '../article/entities/article.entity';
import { Perm } from '../auth/permissions.decorator';

import { DraftVersionService } from './draft-version.service';
import { DraftService } from './draft.service';
import {
  CreateDraftSchema,
  DraftListResponseSchema,
  DraftQuerySchema,
  DraftSchema,
  DraftVersionListResponseSchema,
  DraftVersionSchema,
  UpdateDraftSchema,
  PublishDraftSchema,
} from './dto/draft.dto';

@ApiTags('Drafts')
@Controller({ path: 'drafts', version: '2' })
export class DraftController {
  constructor(
    private readonly draftService: DraftService,
    private readonly draftVersionService: DraftVersionService,
  ) {}

  @Get()
  @Perm('draft', ['read'])
  @ApiOperation({ summary: 'Get all drafts' })
  @ApiResponse({ status: 200, description: 'Return all drafts' })
  async findAll(@Query() raw: unknown): Promise<z.infer<typeof DraftListResponseSchema>> {
    const query = DraftQuerySchema.parse(raw);
    return this.draftService.findAll(query);
  }

  @Get(':id')
  @Perm('draft', ['read'])
  @ApiOperation({ summary: 'Get draft by ID' })
  @ApiResponse({ status: 200, description: 'Return draft' })
  async findOne(@Param('id') id: string): Promise<z.infer<typeof DraftSchema>> {
    return this.draftService.findOne(Number(id));
  }

  @Post()
  @Perm('draft', ['create'])
  @ApiOperation({ summary: 'Create draft' })
  @ApiResponse({ status: 201, description: 'Draft created' })
  async create(@Body() raw: unknown): Promise<z.infer<typeof DraftSchema>> {
    const dto = CreateDraftSchema.parse(raw);
    return this.draftService.create(dto);
  }

  @Put(':id')
  @Perm('draft', ['update'])
  @ApiOperation({ summary: 'Update draft' })
  @ApiResponse({ status: 200, description: 'Draft updated' })
  async update(
    @Param('id') id: string,
    @Body() raw: unknown,
  ): Promise<z.infer<typeof DraftSchema>> {
    const dto = UpdateDraftSchema.parse(raw);
    return this.draftService.update(Number(id), dto);
  }

  @Delete(':id')
  @Perm('draft', ['delete'])
  @ApiOperation({ summary: 'Delete draft' })
  @ApiResponse({ status: 200, description: 'Draft deleted' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.draftService.remove(Number(id));
  }

  @Post(':id/publish')
  @Perm('draft', ['update'])
  @ApiOperation({ summary: 'Publish draft to article' })
  @ApiResponse({ status: 200, description: 'Draft published successfully' })
  async publishDraft(@Param('id', ParseIntPipe) id: number): Promise<Article> {
    return this.publish(id, {
      isPublished: true,
      isTop: false,
      password: null,
      allowComment: true,
    });
  }

  async publish(id: number, raw: unknown): Promise<Article> {
    const publishDto = PublishDraftSchema.parse(raw);
    return this.draftService.publish(id, publishDto);
  }

  async importDrafts(raw: unknown): Promise<void> {
    const draftDtos = z.array(CreateDraftSchema).parse(raw);
    return this.draftService.importDrafts(draftDtos);
  }

  async autoSave(id: number, raw: unknown): Promise<z.infer<typeof DraftSchema>> {
    const dto = UpdateDraftSchema.parse(raw);
    return this.draftService.autoSave(id, dto);
  }

  async getVersions(id: number): Promise<z.infer<typeof DraftVersionListResponseSchema>> {
    const versions = await this.draftVersionService.getVersions(id);
    return {
      items: versions,
      total: versions.length,
      page: 1,
      pageSize: versions.length,
      totalPages: 1,
    };
  }

  async getVersion(id: number, version: number): Promise<z.infer<typeof DraftVersionSchema>> {
    return this.draftVersionService.getVersion(id, version);
  }

  async restoreVersion(id: number, version: number): Promise<void> {
    return this.draftVersionService.restoreVersion(id, version);
  }

  async deleteVersion(id: number, version: number): Promise<void> {
    return this.draftVersionService.deleteVersion(id, version);
  }
}
