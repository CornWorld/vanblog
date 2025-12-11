import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { draftVersions, drafts, selectDraftVersionSchema } from '@vanblog/shared/drizzle';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../database';

import { DraftVersionSchema } from './dto/draft.dto';

@Injectable()
export class DraftVersionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async createVersion(draftId: number): Promise<z.infer<typeof DraftVersionSchema>> {
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
      tags: newVersion.tags ?? [],
      pathname: newVersion.pathname ?? null,
      category: newVersion.category ?? null,
      createdAt: dayjs(newVersion.createdAt).format(),
    };
  }

  async getVersions(draftId: number): Promise<z.infer<typeof DraftVersionSchema>[]> {
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
        tags: version.tags ?? [],
        pathname: version.pathname ?? null,
        category: version.category ?? null,
        createdAt: dayjs(parsed.data.createdAt).format(),
      };
    });
  }

  async getVersion(draftId: number, version: number): Promise<z.infer<typeof DraftVersionSchema>> {
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
      tags: results[0].tags ?? [],
      pathname: versionData.pathname ?? null,
      category: versionData.category ?? null,
      createdAt: dayjs(versionData.createdAt).format(),
    };
  }

  async restoreVersion(draftId: number, version: number): Promise<void> {
    // Get the version data
    const versionData = await this.getVersion(draftId, version);

    // Update the draft with version data
    const tagsToUpdate: string[] | null =
      Array.isArray(versionData.tags) && versionData.tags.length > 0 ? versionData.tags : null;
    await this.db
      .update(drafts)
      .set({
        title: versionData.title,
        content: versionData.content,
        pathname: versionData.pathname ?? null,
        tags: tagsToUpdate,
        category: versionData.category ?? null,
        author: versionData.author,
        updatedAt: dayjs().format(),
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
