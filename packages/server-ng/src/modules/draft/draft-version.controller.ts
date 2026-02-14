import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';

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

  @Perm('draft', ['read'])
  @Get('drafts/:id/versions')
  async listVersions(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ): Promise<{ items: DraftVersion[]; total: number; page: number; pageSize: number }> {
    try {
      const itemsRaw = await this.draftVersionService.getVersions(id);
      const items = Array.isArray(itemsRaw) ? itemsRaw.map((v) => this.mapToDraftVersion(v)) : [];

      const effectivePage = page ?? 1;
      const effectivePageSize = pageSize ?? items.length;
      const total = items.length;

      return { items, total, page: effectivePage, pageSize: effectivePageSize };
    } catch (_err) {
      return { items: [], total: 0, page: 1, pageSize: 0 };
    }
  }

  @Perm('draft', ['read'])
  @Get('drafts/:id/versions/:versionId')
  async getVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ): Promise<DraftVersion> {
    try {
      const v = await this.draftVersionService.getVersion(id, versionId);
      return this.mapToDraftVersion(v);
    } catch (_err) {
      return {
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
      };
    }
  }

  @Perm('draft', ['create'])
  @Post('drafts/:id/versions')
  @HttpCode(201)
  async createVersion(@Param('id', ParseIntPipe) id: number): Promise<DraftVersion> {
    try {
      const v = await this.draftVersionService.createVersion(id);
      return this.mapToDraftVersion(v);
    } catch (_err) {
      return {
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
      };
    }
  }

  @Perm('draft', ['delete'])
  @Delete('drafts/:id/versions/:versionId')
  async deleteVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ): Promise<{ success: boolean }> {
    try {
      await this.draftVersionService.deleteVersion(id, versionId);
      return { success: true };
    } catch (_err) {
      return { success: false };
    }
  }
}
