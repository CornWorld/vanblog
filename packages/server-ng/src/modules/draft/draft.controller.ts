import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';
import { z } from 'zod';

import { Article } from '../article/entities/article.entity';
import { Perm } from '../auth/permissions.decorator';

import { DraftVersionService } from './draft-version.service';
import { DraftService } from './draft.service';
import {
  DraftSchema,
  DraftListResponseSchema,
  DraftQuerySchema,
  DraftVersionSchema,
  DraftVersionListResponseSchema,
  CreateDraftSchema,
  UpdateDraftSchema,
  PublishDraftSchema,
} from './dto/draft.dto';

type DraftItem = z.infer<typeof DraftSchema>;

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

  @TsRestHandler(contract.getDrafts)
  @Perm('draft', ['read'])
  @Get()
  getDrafts(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getDrafts, async ({ query }) => {
      const result = await this.draftService.findAll({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        category: query.category,
        tag: query.tag,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      return {
        status: 200,
        body: {
          ...result,
          items: (result.items as DraftItem[]).map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category ?? undefined,
            tags: item.tags ?? undefined,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
        },
      };
    });
  }

  @TsRestHandler(contract.createDraft)
  @Perm('draft', ['create'])
  @Post()
  createDraft_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.createDraft, async ({ body }) => {
      const result = await this.draftService.create({
        title: body.title,
        content: body.content,
        category: body.category ?? null,
        tags: body.tags ?? null,
        pathname: null,
        author: 'admin',
      });

      return {
        status: 201,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        },
      };
    });
  }

  @TsRestHandler(contract.updateDraft)
  @Perm('draft', ['update'])
  @Put()
  updateDraft_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.updateDraft, async ({ params, body }) => {
      const updateData: Record<string, unknown> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.tags !== undefined) updateData.tags = body.tags;

      const result = await this.draftService.update(
        Number(params.id),
        updateData as z.infer<typeof UpdateDraftSchema>,
      );

      return {
        status: 200,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        },
      };
    });
  }

  @TsRestHandler(contract.deleteDraft)
  @Perm('draft', ['delete'])
  @Delete()
  deleteDraft_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteDraft, async ({ params }) => {
      await this.draftService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getDraft)
  @Perm('draft', ['read'])
  @Get()
  getDraft_tsrest(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.getDraft, async ({ params }) => {
      const result = await this.draftService.findOne(Number(params.id));

      return {
        status: 200,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        },
      };
    });
  }

  @Perm('draft', ['publish'])
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish draft to article' })
  @ApiResponse({ status: 200, description: 'Draft published successfully' })
  async publishDraft_tsrest(@Param('id') id: string): Promise<{
    id: number;
    title: string;
    content: string;
    category?: string;
    views?: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const result = await this.publish(Number(id), {
      isPublished: true,
      isTop: false,
      password: null,
      allowComment: true,
    });
    return {
      id: result.id,
      title: result.title,
      content: result.content,
      category: result.category ?? undefined,
      views: result.viewer ?? undefined,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
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
