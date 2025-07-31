import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { draftVersions, drafts } from '../../db/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { Database } from '../../db/connection';
import { DraftVersion } from './entities/draft.entity';

@Injectable()
export class DraftVersionService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async createVersion(draftId: number): Promise<DraftVersion> {
    // Get current draft to save as version
    const currentDraftResults = await this.db
      .select()
      .from(drafts)
      .where(eq(drafts.id, draftId))
      .limit(1);

    if (currentDraftResults.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(draftId)} not found`);
    }

    const currentDraft = currentDraftResults[0];

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

    const newVersion = result[0];

    return new DraftVersion({
      ...newVersion,
      tags: newVersion.tags ? (JSON.parse(newVersion.tags) as string[]) : [],
      pathname: newVersion.pathname ?? undefined,
      category: newVersion.category ?? undefined,
    });
  }

  async getVersions(draftId: number): Promise<DraftVersion[]> {
    const results = await this.db
      .select()
      .from(draftVersions)
      .where(eq(draftVersions.draftId, draftId))
      .orderBy(desc(draftVersions.version));

    return results.map(
      (version) =>
        new DraftVersion({
          ...version,
          tags: version.tags ? (JSON.parse(version.tags) as string[]) : [],
          pathname: version.pathname ?? undefined,
          category: version.category ?? undefined,
        }),
    );
  }

  async getVersion(draftId: number, version: number): Promise<DraftVersion> {
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

    const versionData = results[0];

    return new DraftVersion({
      ...versionData,
      tags: versionData.tags ? (JSON.parse(versionData.tags) as string[]) : [],
      pathname: versionData.pathname ?? undefined,
      category: versionData.category ?? undefined,
    });
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
        tags: versionData.tags.length > 0 ? JSON.stringify(versionData.tags) : null,
        category: versionData.category ?? null,
        author: versionData.author,
        updatedAt: new Date(),
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
