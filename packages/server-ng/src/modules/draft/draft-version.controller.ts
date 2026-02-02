import { Controller, Get, Post, Delete } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { draftVersionContract } from '@vanblog/shared/contracts';

import { Perm } from '../auth/permissions.decorator';

import { DraftVersionService } from './draft-version.service';

import type { DraftVersion } from '@vanblog/shared/runtime';

@Controller()
export class DraftVersionTsRestController {
  constructor(private readonly draftVersionService: DraftVersionService) {}

  private mapToDraftVersion(v: unknown): DraftVersion {
    const record = v as Record<string, unknown>;
    return {
      id: record.id as number,
      draftId: record.draftId as number,
      version: record.version as number,
      title: (record.title as string | null) ?? '',
      content: (record.content as string | null) ?? '',
      pathname: (record.pathname as string | null) ?? null,
      tags: Array.isArray(record.tags) ? (record.tags as string[]) : null,
      category: (record.category as string | null) ?? null,
      author: (record.author as string | null) ?? '',
      createdAt: (record.createdAt as string | null) ?? new Date().toISOString(),
    };
  }

  @TsRestHandler(draftVersionContract.listVersions)
  @Perm('draft', ['read'])
  @Get()
  listVersions(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(draftVersionContract.listVersions, async ({ params, query }) => {
      try {
        const draftId = Number(params.id);
        const itemsRaw = await this.draftVersionService.getVersions(draftId);
        const items = Array.isArray(itemsRaw) ? itemsRaw.map((v) => this.mapToDraftVersion(v)) : [];

        const page = query?.page ?? 1;
        const pageSize = query?.pageSize ?? items.length;
        const total = items.length;

        return { status: 200, body: { items, total, page, pageSize } };
      } catch (_err) {
        return { status: 200, body: { items: [], total: 0, page: 1, pageSize: 0 } };
      }
    });
  }

  @TsRestHandler(draftVersionContract.getVersion)
  @Perm('draft', ['read'])
  @Get()
  getVersion(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(draftVersionContract.getVersion, async ({ params }) => {
      try {
        const draftId = Number(params.id);
        const versionId = Number(params.versionId);
        const v = await this.draftVersionService.getVersion(draftId, versionId);
        return { status: 200, body: this.mapToDraftVersion(v) };
      } catch (_err) {
        return {
          status: 200,
          body: {
            id: 0,
            draftId: 0,
            version: 0,
            title: '',
            content: '',
            pathname: null,
            tags: null,
            category: null,
            author: '',
            createdAt: new Date().toISOString(),
          },
        };
      }
    });
  }

  @TsRestHandler(draftVersionContract.createVersion)
  @Perm('draft', ['create'])
  @Post()
  createVersion(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(draftVersionContract.createVersion, async ({ params }) => {
      try {
        const draftId = Number(params.id);
        const v = await this.draftVersionService.createVersion(draftId);
        return { status: 201, body: this.mapToDraftVersion(v) };
      } catch (_err) {
        return {
          status: 201,
          body: {
            id: 0,
            draftId: 0,
            version: 0,
            title: '',
            content: '',
            pathname: null,
            tags: null,
            category: null,
            author: '',
            createdAt: new Date().toISOString(),
          },
        };
      }
    });
  }

  @TsRestHandler(draftVersionContract.deleteVersion)
  @Perm('draft', ['delete'])
  @Delete()
  deleteVersion(): ReturnType<typeof tsRestHandler> {
    return tsRestHandler(draftVersionContract.deleteVersion, async ({ params }) => {
      try {
        const draftId = Number(params.id);
        const versionId = Number(params.versionId);
        await this.draftVersionService.deleteVersion(draftId, versionId);
        return { status: 200, body: { success: true } };
      } catch (_err) {
        return { status: 200, body: { success: false } };
      }
    });
  }
}
