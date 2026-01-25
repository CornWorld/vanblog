import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract, dayjs } from '@vanblog/shared';
import { z } from 'zod';

import { Article } from '../article/entities/article.entity';

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

@Controller()
export class DraftController {
  constructor(
    private readonly draftService: DraftService,
    private readonly draftVersionService: DraftVersionService,
  ) {}

  @TsRestHandler(contract.getDrafts)
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
  createDraft(): ReturnType<typeof tsRestHandler> {
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
  updateDraft(): ReturnType<typeof tsRestHandler> {
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
  deleteDraft(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.deleteDraft, async ({ params }) => {
      await this.draftService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getDraft)
  getDraft(): ReturnType<typeof tsRestHandler> {
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

  @TsRestHandler(contract.publishDraft)
  publishDraft(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(contract.publishDraft, async ({ params }) => {
      const result = await this.draftService.publish(Number(params.id), {
        isPublished: true,
        isTop: false,
        password: null,
        allowComment: true,
      });

      return {
        status: 200,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          category: result.category ?? undefined,
          tags: undefined, // Article tags are complex objects, not available from draft publish
          views: result.viewer ?? undefined,
          likes: 0,
          isTop: (result.top ?? 0) > 0,
          isHot: false,
          pubTime: dayjs(result.updatedAt).format(),
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          private: result.private ?? false,
          password: result.password ?? undefined,
          toc: undefined,
        },
      };
    });
  }

  async findAll(raw: unknown): Promise<z.infer<typeof DraftListResponseSchema>> {
    const query = DraftQuerySchema.parse(raw);
    return this.draftService.findAll(query);
  }

  async findOne(id: number): Promise<z.infer<typeof DraftSchema>> {
    return this.draftService.findOne(id);
  }

  async create(raw: unknown): Promise<z.infer<typeof DraftSchema>> {
    const dto = CreateDraftSchema.parse(raw);
    return this.draftService.create(dto);
  }

  async update(id: number, raw: unknown): Promise<z.infer<typeof DraftSchema>> {
    const dto = UpdateDraftSchema.parse(raw);
    return this.draftService.update(id, dto);
  }

  async remove(id: number): Promise<void> {
    return this.draftService.remove(id);
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
