import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import * as bcrypt from 'bcrypt';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { drafts, articles, tags } from '@vanblog/shared/drizzle';
import { safeParseJson, dataSchemas } from '@vanblog/shared/drizzle';
import { Article } from '../article/entities/article.entity';
import { HookService } from '../plugin/services/hook.service';

import { DraftVersionService } from './draft-version.service';
import {
  CreateDraftSchema,
  UpdateDraftSchema,
  DraftQuerySchema,
  DraftListResponseSchema,
  PublishDraftSchema,
  DraftSchema,
} from './dto/draft.dto';

@Injectable()
export class DraftService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly draftVersionService: DraftVersionService,
    private readonly hookService: HookService,
  ) {}

  async findAll(
    query: z.infer<typeof DraftQuerySchema>,
  ): Promise<z.infer<typeof DraftListResponseSchema>> {
    const { page = 1, pageSize = 10, keyword, sortBy = 'updatedAt', sortOrder = 'desc' } = query;

    const conditions = [];

    if (keyword) {
      conditions.push(or(like(drafts.title, `%${keyword}%`), like(drafts.content, `%${keyword}%`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderByClause = (() => {
      let column;
      if (sortBy === 'createdAt') {
        column = drafts.createdAt;
      } else if (sortBy === 'updatedAt') {
        column = drafts.updatedAt;
      } else {
        column = drafts.title;
      }
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

    return {
      items: draftResults.map((draft) => ({
        id: draft.id,
        title: draft.title,
        content: draft.content,
        pathname: draft.pathname,
        category: draft.category,
        tags: safeParseJson(draft.tags, dataSchemas.tagsArray) ?? [],
        author: draft.author,
        version: draft.version,
        createdAt: dayjs(draft.createdAt).format(),
        updatedAt: dayjs(draft.updatedAt).format(),
      })),
      total: (countResult[0]?.count ?? 0) > 0 ? (countResult[0]?.count ?? 0) : 0,
      page,
      pageSize,
      totalPages: Math.ceil(
        ((countResult[0]?.count ?? 0) > 0 ? (countResult[0]?.count ?? 0) : 0) / pageSize,
      ),
    };
  }

  async findOne(id: number): Promise<z.infer<typeof DraftSchema>> {
    const results = await this.db.select().from(drafts).where(eq(drafts.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Draft with ID ${id} not found`);
    }

    const [draft] = results;

    return {
      ...draft,
      tags: safeParseJson(draft.tags, dataSchemas.tagsArray) ?? [],
      pathname: draft.pathname,
      category: draft.category,
      createdAt: dayjs(draft.createdAt).format(),
      updatedAt: dayjs(draft.updatedAt).format(),
    };
  }

  async create(
    createDraftDto: z.infer<typeof CreateDraftSchema>,
  ): Promise<z.infer<typeof DraftSchema>> {
    const { tags, ...rest } = createDraftDto;

    let draftData = {
      title: rest.title,
      content: rest.content,
      pathname: null, // pathname not available in CreateDraftDto
      tags: JSON.stringify(tags),
      category: null, // Use first category from categories array if available
      author: 'admin', // Default author since not in CreateDraftDto
    };

    // Trigger draft|created action hook (new hook system)
    draftData = await this.hookService.applyFilters('draft|beforeCreate', draftData, {
      action: 'create',
    });

    const result = await this.db.insert(drafts).values(draftData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create draft');
    }

    const [newDraft] = result;

    const draftResult = {
      ...newDraft,
      tags: safeParseJson(newDraft.tags, dataSchemas.tagsArray) ?? [],
      pathname: newDraft.pathname,
      category: newDraft.category,
      createdAt: dayjs(newDraft.createdAt).format(),
      updatedAt: dayjs(newDraft.updatedAt).format(),
    };

    // Trigger afterCreateDraft hook (new hook system)
    await this.hookService.doAction('draft|afterCreate', draftResult, { action: 'create' });

    return draftResult;
  }

  async update(
    id: number,
    updateDraftDto: z.infer<typeof UpdateDraftSchema>,
  ): Promise<z.infer<typeof DraftSchema>> {
    // Save a version before updating
    await this.draftVersionService.createVersion(id);

    const { tags, ...rest } = updateDraftDto;

    let updateData: Record<string, unknown> = {};

    if ('title' in rest && rest.title !== undefined) {
      updateData.title = rest.title;
    }

    if ('content' in rest && rest.content !== undefined) {
      updateData.content = rest.content;
    }

    if ('pathname' in rest && rest.pathname !== undefined) {
      updateData.pathname = rest.pathname ?? null;
    }

    // tags is already JSON stringified by the schema transform, can be string or null
    updateData.tags = tags;

    if ('category' in rest && rest.category !== undefined) {
      updateData.category = rest.category ?? null;
    }

    if ('author' in rest && rest.author !== undefined) {
      updateData.author = rest.author;
    }

    updateData.updatedAt = dayjs().format();

    // Trigger draft|before_update hook (new hook system)
    updateData = await this.hookService.applyFilters('draft|beforeUpdate', updateData, {
      action: 'update',
      id,
    });

    const result = await this.db
      .update(drafts)
      .set(updateData)
      .where(eq(drafts.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${id} not found`);
    }

    const [updatedDraft] = result;

    const draftResult = {
      ...updatedDraft,
      tags: safeParseJson(updatedDraft.tags, dataSchemas.tagsArray) ?? [],
      pathname: updatedDraft.pathname,
      category: updatedDraft.category,
      createdAt: dayjs(updatedDraft.createdAt).format(),
      updatedAt: dayjs(updatedDraft.updatedAt).format(),
    };

    // Trigger draft|updated hook (new hook system)
    await this.hookService.doAction('draft|afterUpdate', draftResult, { action: 'update', id });

    return draftResult;
  }

  async remove(id: number): Promise<void> {
    // Delete all versions first
    await this.draftVersionService.deleteAllVersions(id);

    // Trigger draft|before_delete hook (new hook system)
    await this.hookService.doAction('draft|beforeDelete', { id }, { action: 'delete' });

    const result = await this.db
      .delete(drafts)
      .where(eq(drafts.id, id))
      .returning({ id: drafts.id });

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${id} not found`);
    }

    // Trigger draft|deleted hook (new hook system)
    await this.hookService.doAction('draft|afterDelete', { id }, { action: 'delete' });
  }

  async publish(id: number, publishDto: z.infer<typeof PublishDraftSchema>): Promise<Article> {
    // First, get the draft
    const draft = await this.findOne(id);

    // Auto-create tags if they don't exist
    if (draft.tags && draft.tags.length > 0) {
      await this.createMissingTags(draft.tags);
    }

    // hash password if provided
    const hashedPassword = publishDto.password ? await bcrypt.hash(publishDto.password, 10) : null;

    // Create article from draft
    const createdArticles = await this.db
      .insert(articles)
      .values([
        {
          title: draft.title,
          content: draft.content,
          tags: JSON.stringify(draft.tags ?? []),
          author: draft.author,
          pathname: draft.pathname,
          category: draft.category,
          top: publishDto.isTop ? 1 : 0,
          hidden: false,
          private: !!publishDto.password,
          password: hashedPassword,
          viewer: 0,
        },
      ])
      .returning();

    if (createdArticles.length === 0) {
      throw new Error('Failed to publish draft');
    }

    // Delete the draft after successful publication
    await this.remove(id);

    const [newArticle] = createdArticles;

    const articleResult = new Article({
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

    // Trigger webhook event
    await this.hookService.doAction('draft|afterPublish', {
      draftId: id,
      articleId: articleResult.id,
      title: articleResult.title,
      author: articleResult.author,
      category: articleResult.category,
      tags: articleResult.tags,
      pathname: articleResult.pathname,
      publishedAt: dayjs(articleResult.createdAt).format(),
    });

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

  async importDrafts(draftDtos: Array<z.infer<typeof CreateDraftSchema>>): Promise<void> {
    for (const draftDto of draftDtos) {
      await this.create(draftDto);
    }
  }

  async autoSave(
    id: number,
    updateDraftDto: z.infer<typeof UpdateDraftSchema>,
  ): Promise<z.infer<typeof DraftSchema>> {
    // Auto-save doesn't create a version to avoid too many versions
    // Just update the draft directly
    const { tags, ...rest } = updateDraftDto;

    const updateData: Record<string, unknown> = {};

    if ('title' in rest && rest.title !== undefined) {
      updateData.title = rest.title;
    }

    if ('content' in rest && rest.content !== undefined) {
      updateData.content = rest.content;
    }

    if ('pathname' in rest && rest.pathname !== undefined) {
      updateData.pathname = rest.pathname ?? null;
    }

    // tags is already JSON stringified by the schema transform, can be string or null
    updateData.tags = tags;

    if ('category' in rest && rest.category !== undefined) {
      updateData.category = rest.category ?? null;
    }

    if ('author' in rest && rest.author !== undefined) {
      updateData.author = rest.author;
    }

    updateData.updatedAt = dayjs().format();

    const result = await this.db
      .update(drafts)
      .set(updateData)
      .where(eq(drafts.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${id} not found`);
    }

    const [updatedDraft] = result;

    return {
      ...updatedDraft,
      tags: safeParseJson(updatedDraft.tags, dataSchemas.tagsArray) ?? [],
      pathname: updatedDraft.pathname,
      category: updatedDraft.category,
      createdAt: dayjs(updatedDraft.createdAt).format(),
      updatedAt: dayjs(updatedDraft.updatedAt).format(),
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

      // Ensure we call returning() so upstream tests/mocks that expect it remain aligned
      await this.db.insert(tags).values(tagsToCreate).returning();
    }
  }
}
