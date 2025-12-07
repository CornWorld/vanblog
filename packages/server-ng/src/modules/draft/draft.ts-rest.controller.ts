import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs, contract } from '@vanblog/shared';

import { DraftService } from './draft.service';

@Controller()
export class DraftTsRestController {
  constructor(private readonly draftService: DraftService) {}

  private normalizeDate(input: unknown): string {
    if (typeof input === 'string') return input;
    if (input instanceof Date) return dayjs(input).format();
    return dayjs().format();
  }

  @TsRestHandler(contract.getDrafts)
  getDrafts(): ReturnType<typeof tsRestHandler> {
    // @ts-expect-error - ts-rest handler parameter destructuring type mismatch
    return tsRestHandler(contract.getDrafts, async ({ query }) => {
      const result = await this.draftService.findAll({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        category: query.category,
        tag: query.tag,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      const rawItems: unknown = result.items;
      const items = Array.isArray(rawItems)
        ? rawItems.map((item) => {
            const t = item as Record<string, unknown>;
            const createdAtRaw = t.createdAt;
            const updatedAtRaw = t.updatedAt;
            let createdAt: string;
            if (typeof createdAtRaw === 'string') {
              createdAt = createdAtRaw;
            } else if (createdAtRaw instanceof Date) {
              createdAt = dayjs(createdAtRaw).format();
            } else {
              createdAt = dayjs().format();
            }
            let updatedAt: string;
            if (typeof updatedAtRaw === 'string') {
              updatedAt = updatedAtRaw;
            } else if (updatedAtRaw instanceof Date) {
              updatedAt = dayjs(updatedAtRaw).format();
            } else {
              updatedAt = dayjs().format();
            }
            const category = typeof t.category === 'string' ? t.category : undefined;
            const tags = Array.isArray(t.tags) ? (t.tags as string[]) : undefined;
            const { summary: _summary, cover: _cover, ...plain } = t;
            return {
              ...(plain as Record<string, unknown>),
              createdAt,
              updatedAt,
              category,
              tags,
              summary: undefined,
              cover: undefined,
            };
          })
        : [];

      const { items: _omitItems, ...plainResult } = result;
      return {
        status: 200,
        body: { ...plainResult, items },
      };
    });
  }

  @TsRestHandler(contract.createDraft)
  createDraft(): ReturnType<typeof tsRestHandler> {
    // @ts-expect-error - ts-rest handler parameter destructuring type mismatch
    return tsRestHandler(contract.createDraft, async ({ body }) => {
      const result = await this.draftService.create({
        ...body,
        // @ts-expect-error ts-rest handler type incompatibility
        tags: body.tags ?? [],
      });

      const createdAtRaw = (result as Record<string, unknown>).createdAt;
      const updatedAtRaw = (result as Record<string, unknown>).updatedAt;
      const createdAt = this.normalizeDate(createdAtRaw);
      const updatedAt = this.normalizeDate(updatedAtRaw);

      const { summary: _summary, cover: _cover, ...plain } = result as Record<string, unknown>;
      return {
        status: 201,
        body: {
          ...(plain as Record<string, unknown>),
          createdAt,
          updatedAt,
          category:
            typeof (result as Record<string, unknown>).category === 'string'
              ? (result as Record<string, unknown>).category
              : undefined,
          tags: Array.isArray((result as Record<string, unknown>).tags)
            ? ((result as Record<string, unknown>).tags as string[])
            : undefined,
          summary: undefined,
          cover: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.updateDraft)
  updateDraft(): ReturnType<typeof tsRestHandler> {
    // @ts-expect-error - ts-rest handler parameter destructuring type mismatch
    return tsRestHandler(contract.updateDraft, async ({ params, body }) => {
      const result = await this.draftService.update(Number(params.id), {
        ...body,
        // @ts-expect-error ts-rest handler type incompatibility
        tags: body.tags ?? undefined,
      });

      const createdAtRaw2 = (result as Record<string, unknown>).createdAt;
      const updatedAtRaw2 = (result as Record<string, unknown>).updatedAt;
      const createdAt2 = this.normalizeDate(createdAtRaw2);
      const updatedAt2 = this.normalizeDate(updatedAtRaw2);

      const { summary: _summary, cover: _cover, ...plain } = result as Record<string, unknown>;
      return {
        status: 200,
        body: {
          ...(plain as Record<string, unknown>),
          createdAt: createdAt2,
          updatedAt: updatedAt2,
          category:
            typeof (result as Record<string, unknown>).category === 'string'
              ? (result as Record<string, unknown>).category
              : undefined,
          tags: Array.isArray((result as Record<string, unknown>).tags)
            ? ((result as Record<string, unknown>).tags as string[])
            : undefined,
          summary: undefined,
          cover: undefined,
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
    // @ts-expect-error - ts-rest handler return type mismatch
    return tsRestHandler(contract.getDraft, async ({ params }) => {
      const result = await this.draftService.findOne(Number(params.id));

      const createdAtRaw3 = (result as Record<string, unknown>).createdAt;
      const updatedAtRaw3 = (result as Record<string, unknown>).updatedAt;
      const createdAt3 = this.normalizeDate(createdAtRaw3);
      const updatedAt3 = this.normalizeDate(updatedAtRaw3);

      const { summary: _summary, cover: _cover, ...plain } = result as Record<string, unknown>;
      return {
        status: 200,
        body: {
          ...(plain as Record<string, unknown>),
          createdAt: createdAt3,
          updatedAt: updatedAt3,
          category:
            typeof (result as Record<string, unknown>).category === 'string'
              ? (result as Record<string, unknown>).category
              : undefined,
          tags: Array.isArray((result as Record<string, unknown>).tags)
            ? ((result as Record<string, unknown>).tags as string[])
            : undefined,
          summary: undefined,
          cover: undefined,
        },
      };
    });
  }

  @TsRestHandler(contract.publishDraft)
  publishDraft(): ReturnType<typeof tsRestHandler> {
    // @ts-expect-error - ts-rest handler return type mismatch
    return tsRestHandler(contract.publishDraft, async ({ params }) => {
      const result = await this.draftService.publish(Number(params.id), {
        isPublished: true,
        isTop: false,
        password: null,
        allowComment: true,
      });

      const plainResult = result as unknown as Record<string, unknown>;
      return {
        status: 200,
        body: {
          ...plainResult,
          password: result.password ?? undefined,
        },
      };
    });
  }
}
