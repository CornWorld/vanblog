import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { dayjs } from '@vanblog/shared';
import { draftVersionContract as draftVersionShared } from '@vanblog/shared/src/contracts/draft-version.contract';
import { z } from 'zod';

import { DraftVersionService } from './draft-version.service';
import { DraftVersionSchema } from './dto/draft.dto';

const draftVersionContract = draftVersionShared;

type DraftVersionData = z.infer<typeof DraftVersionSchema>;

@Controller()
export class DraftVersionTsRestController {
  constructor(private readonly draftVersionService: DraftVersionService) {}

  private toStr(v: unknown): string {
    return typeof v === 'string' ? v : String(v ?? '');
  }

  private dateStr(input: unknown): string {
    if (typeof input === 'string') return input;
    if (input instanceof Date) return dayjs(input).format();
    return dayjs().format();
  }

  @TsRestHandler(draftVersionContract.listVersions)
  listVersions() {
    return tsRestHandler(draftVersionContract.listVersions, async ({ params, query }) => {
      try {
        const draftId = Number(params.id);
        const itemsRaw = await this.draftVersionService.getVersions(draftId);
        const items = Array.isArray(itemsRaw)
          ? itemsRaw.map((v: DraftVersionData) => ({
              id: this.toStr(v.id),
              draftId: this.toStr(v.draftId),
              version: this.toStr(v.version),
              createdAt: this.dateStr(v.createdAt),
              updatedAt: undefined,
            }))
          : [];

        const page = this.toStr(query?.page ?? '1');
        const pageSize = this.toStr(query?.pageSize ?? String(items.length));
        const total = this.toStr(String(items.length));

        return { status: 200, body: { items, total, page, pageSize } };
      } catch (_err) {
        return { status: 200, body: { items: [], total: '0', page: '1', pageSize: '0' } };
      }
    });
  }

  @TsRestHandler(draftVersionContract.getVersion)
  getVersion() {
    return tsRestHandler(draftVersionContract.getVersion, async ({ params }) => {
      try {
        const draftId = Number(params.id);
        const versionId = Number(params.versionId);
        const v = await this.draftVersionService.getVersion(draftId, versionId);
        const meta = {
          id: this.toStr(v.id),
          draftId: this.toStr(v.draftId),
          version: this.toStr(v.version),
          createdAt: this.dateStr(v.createdAt),
          updatedAt: undefined,
        };
        const data = {
          title: this.toStr(v.title),
          content: this.toStr(v.content),
          summary: undefined,
          cover: undefined,
          category: typeof v.category === 'string' ? v.category : undefined,
          tags: Array.isArray(v.tags) ? v.tags : undefined,
        };
        return { status: 200, body: { meta, data } };
      } catch (_err) {
        return {
          status: 200,
          body: {
            meta: { id: '', draftId: '', version: '', createdAt: dayjs().format() },
            data: { title: '', content: '' },
          },
        };
      }
    });
  }

  @TsRestHandler(draftVersionContract.createVersion)
  createVersion() {
    return tsRestHandler(draftVersionContract.createVersion, async ({ params }) => {
      try {
        const draftId = Number(params.id);
        const v = await this.draftVersionService.createVersion(draftId);
        return {
          status: 201,
          body: {
            id: this.toStr(v.id),
            draftId: this.toStr(v.draftId),
            version: this.toStr(v.version),
            createdAt: this.dateStr(v.createdAt),
            updatedAt: undefined,
          },
        };
      } catch (_err) {
        return {
          status: 201,
          body: { id: '', draftId: '', version: '', createdAt: dayjs().format() },
        };
      }
    });
  }

  @TsRestHandler(draftVersionContract.deleteVersion)
  deleteVersion() {
    return tsRestHandler(draftVersionContract.deleteVersion, async ({ params }) => {
      try {
        const draftId = Number(params.id);
        const versionId = Number(params.versionId);
        await this.draftVersionService.deleteVersion(draftId, versionId);
        return { status: 200, body: { success: 'true' as const } };
      } catch (_err) {
        return { status: 200, body: { success: 'false' as const } };
      }
    });
  }
}
