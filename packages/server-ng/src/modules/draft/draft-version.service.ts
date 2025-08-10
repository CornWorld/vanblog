import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, and, desc, sql } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database';
import { draftVersions, drafts } from '../../database/schema';
import { selectDraftVersionSchema } from '../../database/zod-schemas';
import { safeParseJson, dataSchemas } from '../../shared/zod';

import { DraftVersionDto } from './dto/draft.dto';

import type { Database } from '../../database/connection';

@Injectable()
export class DraftVersionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async createVersion(draftId: number): Promise<DraftVersionDto> {
    // Get current draft to save as version
    const currentDraftResults = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, draftId))
      .limit(1);

    if (currentDraftResults.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(draftId)} not found`);
    }

    const [currentDraft] = currentDraftResults;

    // Get the next version number
    const maxVersionResult = await this.db
      .select({ maxVersion: sql<number>`coalesce(max(${draftVersions.version}), 0)` })
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draftId));

    const nextVersion = (maxVersionResult[0]?.maxVersion ?? 0) + 1;

    // Create version record
    const result = await this.db
      .insert(draftVersions)
      .values({
        draftId,
        version: nextVersion,
        title: currentDraft.title,
        content: currentDraft.content,
        pathname: currentDraft.pathname,
        tags: currentDraft.tags,
        category: currentDraft.category,
        author: currentDraft.author,
      })
      .returning();

    if (result.length === 0) {
      throw new Error('Failed to create draft version');
    }

    const [newVersion] = result;

    return {
      ...newVersion,
      tags: safeParseJson(newVersion.tags, dataSchemas.tagsArray) ?? [],
      pathname: newVersion.pathname ?? null,
      category: newVersion.category ?? null,
      createdAt: dayjs(newVersion.createdAt),
    };
  }

  async getVersions(draftId: number): Promise<DraftVersionDto[]> {
    const results = await this.db
      .select()
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draftId))
      .orderBy(desc(draftVersions.version));

    return results.map((version) => {
      const parsed = selectDraftVersionSchema.safeParse(version);
      if (!parsed.success) {
        throw new Error(`Failed to parse draft version: ${parsed.error.message}`);
      }
      return {
        ...parsed.data,
        tags: safeParseJson(version.tags, dataSchemas.tagsArray) ?? [],
        pathname: version.pathname ?? null,
        category: version.category ?? null,
        createdAt: parsed.data.createdAt,
      };
    });
  }

  async getVersion(draftId: number, version: number): Promise<DraftVersionDto> {
    const results = await this.db
      .select()
      .from(draftVersions)
      .where(and(eq(draftVersions.draftId, draftId), eq(draftVersions.version, version)))
      .limit(1);

    if (results.length === 0) {
      throw new NotFoundException(
        `Draft version ${String(version)} not found for draft ${String(draftId)}`,
      );
    }

    const parseResult = selectDraftVersionSchema.safeParse(results[0]);
    if (!parseResult.success) {
      throw new Error(`Failed to parse draft version: ${parseResult.error.message}`);
    }

    const versionData = parseResult.data;
    return {
      ...versionData,
      tags: safeParseJson(results[0].tags, dataSchemas.tagsArray) ?? [],
      pathname: versionData.pathname ?? null,
      category: versionData.category ?? null,
      createdAt: versionData.createdAt,
    };
  }

  async restoreVersion(draftId: number, version: number): Promise<void> {
    // Get the version data
    const versionData = await this.getVersion(draftId, version);

    // Update the draft with version data
    await this.db
      .update(drafts)
      .set({
        title: versionData.title,
        content: versionData.content,
        pathname: versionData.pathname ?? null,
        tags:
          versionData.tags && versionData.tags.length > 0 ? JSON.stringify(versionData.tags) : null,
        category: versionData.category ?? null,
        author: versionData.author,
        updatedAt: dayjs().toISOString(),
      })
      .where(eq(drafts.id, draftId));
  }

  async deleteVersion(draftId: number, version: number): Promise<void> {
    const result = await this.db
      .delete(draftVersions)
      .where(and(eq(draftVersions.draftId, draftId), eq(draftVersions.version, version)))
      .returning({ id: draftVersions.id });

    if (result.length === 0) {
      throw new NotFoundException(
        `Draft version ${String(version)} not found for draft ${String(draftId)}`,
      );
    }
  }

  async deleteAllVersions(draftId: number): Promise<void> {
    await this.db.delete(draftVersions).where(eq(draftVersions.draftId, draftId));
  }
}
