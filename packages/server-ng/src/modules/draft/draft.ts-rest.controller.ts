/* eslint-disable @typescript-eslint/no-explicit-any */

import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { DraftService } from './draft.service';

import type { DraftDto } from './dto/draft.dto';

@Controller()
export class DraftTsRestController {
  constructor(private readonly draftService: DraftService) {}

  @TsRestHandler(contract.getDrafts)
  getDrafts() {
    return tsRestHandler(contract.getDrafts, async ({ query }) => {
      const result = await this.draftService.findAll({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        category: query.category,
        tag: query.tag,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      const items = (result.items as DraftDto[]).map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        pathname: item.pathname,
        author: item.author,
        category: item.category ?? undefined,
        tags: item.tags ?? undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        version: item.version,
        summary: undefined,
        cover: undefined,
      }));

      return {
        status: 200,
        body: { ...result, items },
      };
    });
  }

  @TsRestHandler(contract.createDraft)
  createDraft() {
    return tsRestHandler(contract.createDraft, async ({ body }) => {
      const result = await this.draftService.create({
        ...body,
        tags: body.tags ? JSON.stringify(body.tags) : '[]',
      } as any);

      return {
        status: 201,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          pathname: result.pathname,
          author: result.author,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
          version: result.version,
          summary: undefined,
          cover: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.updateDraft)
  updateDraft() {
    return tsRestHandler(contract.updateDraft, async ({ params, body }) => {
      const result = await this.draftService.update(Number(params.id), {
        ...body,
        tags: body.tags ? JSON.stringify(body.tags) : null,
      });

      return {
        status: 200,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          pathname: result.pathname,
          author: result.author,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
          version: result.version,
          summary: undefined,
          cover: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.deleteDraft)
  deleteDraft() {
    return tsRestHandler(contract.deleteDraft, async ({ params }) => {
      await this.draftService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getDraft)
  getDraft() {
    return tsRestHandler(contract.getDraft, async ({ params }) => {
      const result = await this.draftService.findOne(Number(params.id));

      return {
        status: 200,
        body: {
          id: result.id,
          title: result.title,
          content: result.content,
          pathname: result.pathname,
          author: result.author,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
          version: result.version,
          summary: undefined,
          cover: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.publishDraft)
  publishDraft() {
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
          ...result,
          password: result.password ?? undefined,
          category: result.category ?? undefined,
          tags: undefined,
          private: result.private ?? undefined,
        },
      };
    });
  }
}
