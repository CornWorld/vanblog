/* eslint-disable @typescript-eslint/no-explicit-any */

import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@vanblog/shared';

import { DraftService } from './draft.service';

@Controller()
export class DraftTsRestController {
  constructor(private readonly draftService: DraftService) {}

  @TsRestHandler(contract.getDrafts)
  getDrafts(): any {
    return tsRestHandler(contract.getDrafts, async ({ query }) => {
      const result = await this.draftService.findAll({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        category: query.category,
        tag: query.tag,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      const items = result.items.map((item) => {
        const createdAt = (item.createdAt as any).toISOString();
        const updatedAt = (item.updatedAt as any).toISOString();

        const plain = Object.assign({}, item);
        return {
          ...plain,
          createdAt,
          updatedAt,
          category: item.category ?? undefined,
          tags: item.tags ?? undefined,
          summary: undefined,
          cover: undefined,
        };
      });

      const plainResult = Object.assign({}, result);
      return {
        status: 200,
        body: { ...plainResult, items } as any,
      };
    });
  }

  @TsRestHandler(contract.createDraft)
  createDraft(): any {
    return tsRestHandler(contract.createDraft, async ({ body }) => {
      const result = await this.draftService.create({
        ...body,
        tags: body.tags ?? [],
      } as any);

      const createdAt = (result.createdAt as any).toISOString();
      const updatedAt = (result.updatedAt as any).toISOString();

      const plain = Object.assign({}, result);
      return {
        status: 201,
        body: {
          ...plain,
          createdAt,
          updatedAt,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          summary: undefined,
          cover: undefined,
        } as any,
      };
    });
  }

  @TsRestHandler(contract.updateDraft)
  updateDraft(): any {
    return tsRestHandler(contract.updateDraft, async ({ params, body }) => {
      const result = await this.draftService.update(Number(params.id), {
        ...body,
        tags: body.tags ?? undefined,
      } as any);

      const createdAt = (result.createdAt as any).toISOString();
      const updatedAt = (result.updatedAt as any).toISOString();

      const plain = Object.assign({}, result);
      return {
        status: 200,
        body: {
          ...plain,
          createdAt,
          updatedAt,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          summary: undefined,
          cover: undefined,
        } as any,
      };
    });
  }

  @TsRestHandler(contract.deleteDraft)
  deleteDraft(): any {
    return tsRestHandler(contract.deleteDraft, async ({ params }) => {
      await this.draftService.remove(Number(params.id));
      return { status: 200, body: { success: true } };
    });
  }

  @TsRestHandler(contract.getDraft)
  getDraft(): any {
    return tsRestHandler(contract.getDraft, async ({ params }) => {
      const result = await this.draftService.findOne(Number(params.id));

      const createdAt = (result.createdAt as any).toISOString();
      const updatedAt = (result.updatedAt as any).toISOString();

      const plain = Object.assign({}, result);
      return {
        status: 200,
        body: {
          ...plain,
          createdAt,
          updatedAt,
          category: result.category ?? undefined,
          tags: result.tags ?? undefined,
          summary: undefined,
          cover: undefined,
        } as any,
      };
    });
  }

  @TsRestHandler(contract.publishDraft)
  publishDraft(): any {
    return tsRestHandler(contract.publishDraft, async ({ params }) => {
      const result = await this.draftService.publish(Number(params.id), {
        isPublished: true,
        isTop: false,
        password: null,
        allowComment: true,
      });

      const plain = Object.assign({}, result);
      return {
        status: 200,
        body: {
          ...plain,
          password: result.password ?? undefined,
        } as any,
      };
    });
  }
}
