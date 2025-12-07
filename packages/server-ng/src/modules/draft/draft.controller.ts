import { Controller } from '@nestjs/common';
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

@Controller()
export class DraftController {
  constructor(
    private readonly draftService: DraftService,
    private readonly draftVersionService: DraftVersionService,
  ) {}

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
