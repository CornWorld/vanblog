import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database';
import { drafts, articles, tags } from '../../database/schema';
import { safeParseJson, dataSchemas } from '../../shared/zod';
import { Article } from '../article/entities/article.entity';
import { HookService } from '../plugin/services/hook.service';

import { DraftVersionService } from './draft-version.service';
import {
  CreateDraftDto,
  UpdateDraftDto,
  DraftQueryDto,
  DraftListResponseDto,
  PublishDraftDto,
  DraftDto,
} from './dto/draft.dto';
// import { Draft } from './entities/draft.entity';

import type { Database } from '../../database/connection';

@Injectable()
export class DraftService {
  private readonly logger = new Logger(DraftService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly draftVersionService: DraftVersionService,
    private readonly hookService: HookService,
  ) {}

  async findAll(query: DraftQueryDto): Promise<DraftListResponseDto> {
    const { page = 1, pageSize = 10, keyword, sortBy = 'updatedAt', sortOrder = 'desc' } = query;

    const conditions = [];

    if (keyword) {
      conditions.push(or(like(drafts.title, `%${keyword}%`), like(drafts.content, `%${keyword}%`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByClause = (() => {
      const column =
        sortBy === 'createdAt'
          ? drafts.createdAt
          : sortBy === 'updatedAt'
            ? drafts.updatedAt
            : drafts.title;
      return sortOrder === 'asc' ? asc(column) : desc(column);
    })();

    const [draftResults, countResult] = await Promise.all([
      this.db
        .select()
        .from(drafts)
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(drafts)
        .where(whereClause),
    ]);

    const processedDrafts = draftResults.map((draft) => ({
      ...draft,
      tags: safeParseJson(draft.tags, dataSchemas.tagsArray) ?? [],
      categories: draft.category ? [draft.category] : [],
      pathname: draft.pathname,
      category: draft.category,
      userId: 1,
      wordCount: draft.content ? draft.content.length : 0,
      readTime: Math.ceil((draft.content ? draft.content.length : 0) / 200),
      summary: undefined,
      cover: undefined,
    }));

    return {
      items: processedDrafts.map((draft) => ({
        id: draft.id,
        title: draft.title,
        content: draft.content,
        pathname: draft.pathname,
        category: draft.category,
        tags: draft.tags,
        author: draft.author,
        version: draft.version,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      })),
      total: Number(countResult[0]?.count) || 0,
      page,
      pageSize,
      totalPages: Math.ceil((Number(countResult[0]?.count) || 0) / pageSize),
    };
  }

  async findOne(id: number): Promise<DraftDto> {
    const results = await this.db.select().from(drafts).where(eq(drafts.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const draft = results[0];

    return {
      ...draft,
      tags: safeParseJson(draft.tags, dataSchemas.tagsArray) ?? [],
      pathname: draft.pathname,
      category: draft.category,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }

  async create(createDraftDto: CreateDraftDto): Promise<DraftDto> {
    const { tags, ...rest } = createDraftDto;

    let draftData = {
      title: rest.title,
      content: rest.content,
      pathname: null, // pathname not available in CreateDraftDto
      tags: JSON.stringify(tags),
      category: null, // Use first category from categories array if available
      author: 'admin', // Default author since not in CreateDraftDto
    };

    // Trigger beforeCreateDraft hook (new hook system)
    try {
      draftData = await this.hookService.applyFilters('beforeCreateDraft', draftData, {
        action: 'create',
      });
    } catch (error) {
      this.logger.error('Error in beforeCreateDraft hook:', error);
    }

    const result = await this.db.insert(drafts).values(draftData).returning();

    if (!result.length) {
      throw new Error('Failed to create draft');
    }

    const newDraft = result[0];
    const draftResult = {
      ...newDraft,
      tags: safeParseJson(newDraft.tags, dataSchemas.tagsArray) ?? [],
      pathname: newDraft.pathname,
      category: newDraft.category,
      createdAt: newDraft.createdAt.toISOString(),
      updatedAt: newDraft.updatedAt.toISOString(),
    };

    // Trigger afterCreateDraft hook (new hook system)
    try {
      await this.hookService.doAction('afterCreateDraft', draftResult, { action: 'create' });
    } catch (error) {
      this.logger.error('Error in afterCreateDraft hook:', error);
    }

    return draftResult;
  }

  async update(id: number, updateDraftDto: UpdateDraftDto): Promise<DraftDto> {
    // Save a version before updating
    await this.draftVersionService.createVersion(id);

    const { tags, ...rest } = updateDraftDto;

    let updateData: Record<string, unknown> = {};

    if ('title' in rest) {
      updateData.title = rest.title;
    }

    if ('content' in rest) {
      updateData.content = rest.content;
    }

    if ('pathname' in rest) {
      updateData.pathname = rest.pathname ?? null;
    }

    if (tags) {
      updateData.tags = JSON.stringify(tags);
    }

    if ('category' in rest) {
      updateData.category = rest.category ?? null;
    }

    if ('author' in rest) {
      updateData.author = rest.author;
    }

    updateData.updatedAt = new Date();

    // Trigger beforeUpdateDraft hook (new hook system)
    try {
      updateData = await this.hookService.applyFilters('beforeUpdateDraft', updateData, {
        action: 'update',
        id,
      });
    } catch (error) {
      this.logger.error('Error in beforeUpdateDraft hook:', error);
    }

    const result = await this.db
      .update(drafts)
      .set(updateData)
      .where(eq(drafts.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const updatedDraft = result[0];
    const draftResult = {
      ...updatedDraft,
      tags: safeParseJson(updatedDraft.tags, dataSchemas.tagsArray) ?? [],
      pathname: updatedDraft.pathname,
      category: updatedDraft.category,
      createdAt: updatedDraft.createdAt.toISOString(),
      updatedAt: updatedDraft.updatedAt.toISOString(),
    };

    // Trigger afterUpdateDraft hook (new hook system)
    try {
      await this.hookService.doAction('afterUpdateDraft', draftResult, { action: 'update', id });
    } catch (error) {
      this.logger.error('Error in afterUpdateDraft hook:', error);
    }

    return draftResult;
  }

  async remove(id: number): Promise<void> {
    // Delete all versions first
    await this.draftVersionService.deleteAllVersions(id);

    // Trigger beforeDeleteDraft hook (new hook system)
    try {
      await this.hookService.doAction('beforeDeleteDraft', { id }, { action: 'delete' });
    } catch (error) {
      this.logger.error('Error in beforeDeleteDraft hook:', error);
    }

    const result = await this.db
      .delete(drafts)
      .where(eq(drafts.id, id))
      .returning({ id: drafts.id });

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    // Trigger afterDeleteDraft hook (new hook system)
    try {
      await this.hookService.doAction('afterDeleteDraft', { id }, { action: 'delete' });
    } catch (error) {
      this.logger.error('Error in afterDeleteDraft hook:', error);
    }
  }

  async publish(id: number, publishDto: PublishDraftDto): Promise<Article> {
    // First, get the draft
    const draft = await this.findOne(id);

    // Auto-create tags if they don't exist
    if (draft.tags && draft.tags.length > 0) {
      await this.createMissingTags(draft.tags);
    }

    // Create article from draft
    const result = await this.db
      .insert(articles)
      .values({
        title: draft.title,
        content: draft.content,
        pathname: draft.pathname ?? null,
        tags: draft.tags && draft.tags.length > 0 ? JSON.stringify(draft.tags) : null,
        category: draft.category ?? null,
        author: draft.author,
        top: publishDto.isTop ? 1 : 0,
        hidden: false,
        private: false,
        password: publishDto.password ?? null,
        viewer: 0,
      })
      .returning();

    if (result.length === 0) {
      throw new Error('Failed to publish draft');
    }

    // Delete the draft after successful publication
    await this.remove(id);

    const newArticle = result[0];

    return new Article({
      ...newArticle,
      tags: safeParseJson(newArticle.tags, dataSchemas.tagsArray) ?? [],
      pathname: newArticle.pathname,
      category: newArticle.category,
      author: newArticle.author,
      top: newArticle.top,
      hidden: newArticle.hidden,
      private: newArticle.private,
      password: newArticle.password,
      viewer: newArticle.viewer,
    });
  }

  async importDrafts(draftDtos: CreateDraftDto[]): Promise<void> {
    for (const draftDto of draftDtos) {
      await this.create(draftDto);
    }
  }

  async autoSave(id: number, updateDraftDto: UpdateDraftDto): Promise<DraftDto> {
    // Auto-save doesn't create a version to avoid too many versions
    // Just update the draft directly
    const { tags, ...rest } = updateDraftDto;

    const updateData: Record<string, unknown> = {};

    if ('title' in rest) {
      updateData.title = rest.title;
    }

    if ('content' in rest) {
      updateData.content = rest.content;
    }

    if ('pathname' in rest) {
      updateData.pathname = rest.pathname ?? null;
    }

    if (tags) {
      updateData.tags = JSON.stringify(tags);
    }

    if ('category' in rest) {
      updateData.category = rest.category ?? null;
    }

    if ('author' in rest) {
      updateData.author = rest.author;
    }

    updateData.updatedAt = new Date();

    const result = await this.db
      .update(drafts)
      .set(updateData)
      .where(eq(drafts.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const updatedDraft = result[0];

    return {
      ...updatedDraft,
      tags: safeParseJson(updatedDraft.tags, dataSchemas.tagsArray) ?? [],
      pathname: updatedDraft.pathname,
      category: updatedDraft.category,
      createdAt: updatedDraft.createdAt.toISOString(),
      updatedAt: updatedDraft.updatedAt.toISOString(),
    };
  }

  private async createMissingTags(tagNames: string[]): Promise<void> {
    // Get existing tags
    const existingTags = await this.db.select().from(tags);
    const existingTagNames = new Set(existingTags.map((tag) => tag.name));

    // Find tags that need to be created
    const missingTags = tagNames.filter((tagName) => !existingTagNames.has(tagName));

    // Create missing tags
    if (missingTags.length > 0) {
      const tagsToCreate = missingTags.map((tagName) => ({
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
      }));

      await this.db.insert(tags).values(tagsToCreate);
    }
  }
}
