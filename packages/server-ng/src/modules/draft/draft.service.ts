import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import {
  CreateDraftDto,
  UpdateDraftDto,
  DraftQueryDto,
  DraftListResponseDto,
  PublishDraftDto,
} from './dto/draft.dto';
import { drafts, articles, tags } from '../../database/schema';
import { DATABASE_CONNECTION } from '../../database';
import type { Database } from '../../database/connection';
import { Draft } from './entities/draft.entity';
import { Article } from '../article/entities/article.entity';
import { DraftVersionService } from './draft-version.service';

@Injectable()
export class DraftService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly draftVersionService: DraftVersionService,
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
            : sortBy === 'title'
              ? drafts.title
              : drafts.updatedAt;
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
      tags: draft.tags ? (JSON.parse(draft.tags) as string[]) : [],
      categories: draft.tags ? (JSON.parse(draft.tags) as string[]) : [],
      pathname: draft.pathname ?? undefined,
      category: draft.category ?? undefined,
      userId: 1,
      wordCount: draft.content ? draft.content.length : 0,
      readTime: Math.ceil((draft.content ? draft.content.length : 0) / 200),
      summary: undefined,
      cover: undefined,
    }));

    return {
      items: processedDrafts.map((draft) => new Draft(draft)),
      total: countResult[0]?.count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / pageSize),
    };
  }

  async findOne(id: number): Promise<Draft> {
    const results = await this.db.select().from(drafts).where(eq(drafts.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const draft = results[0];

    return new Draft({
      ...draft,
      tags: draft.tags ? (JSON.parse(draft.tags) as string[]) : [],
      pathname: draft.pathname ?? undefined,
      category: draft.category ?? undefined,
    });
  }

  async create(createDraftDto: CreateDraftDto): Promise<Draft> {
    const { tags, ...rest } = createDraftDto;

    const result = await this.db
      .insert(drafts)
      .values({
        title: rest.title,
        content: rest.content,
        pathname: null, // pathname not available in CreateDraftDto
        tags: tags ? JSON.stringify(tags) : null,
        category: null, // Use first category from categories array if available
        author: 'admin', // Default author since not in CreateDraftDto
      })
      .returning();

    if (!result.length) {
      throw new Error('Failed to create draft');
    }

    const newDraft = result[0];

    return new Draft({
      ...newDraft,
      tags: newDraft.tags ? (JSON.parse(newDraft.tags) as string[]) : [],
      pathname: newDraft.pathname ?? undefined,
      category: newDraft.category ?? undefined,
    });
  }

  async update(id: number, updateDraftDto: UpdateDraftDto): Promise<Draft> {
    // Save a version before updating
    await this.draftVersionService.createVersion(id);

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

    if (tags !== undefined) {
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

    return new Draft({
      ...updatedDraft,
      tags: updatedDraft.tags ? (JSON.parse(updatedDraft.tags) as string[]) : [],
      pathname: updatedDraft.pathname ?? undefined,
      category: updatedDraft.category ?? undefined,
    });
  }

  async remove(id: number): Promise<void> {
    // Delete all versions first
    await this.draftVersionService.deleteAllVersions(id);

    const result = await this.db
      .delete(drafts)
      .where(eq(drafts.id, id))
      .returning({ id: drafts.id });

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }
  }

  async publish(id: number, publishDto: PublishDraftDto): Promise<Article> {
    // First, get the draft
    const draft = await this.findOne(id);

    // Auto-create tags if they don't exist
    if (draft.tags.length > 0) {
      await this.createMissingTags(draft.tags);
    }

    // Create article from draft
    const result = await this.db
      .insert(articles)
      .values({
        title: draft.title,
        content: draft.content,
        pathname: draft.pathname ?? null,
        tags: draft.tags.length > 0 ? JSON.stringify(draft.tags) : null,
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
      tags: newArticle.tags ? (JSON.parse(newArticle.tags) as string[]) : [],
      pathname: newArticle.pathname ?? undefined,
      category: newArticle.category ?? undefined,
      author: newArticle.author,
      top: newArticle.top ?? undefined,
      hidden: newArticle.hidden ?? undefined,
      private: newArticle.private ?? undefined,
      password: newArticle.password ?? undefined,
      viewer: newArticle.viewer ?? undefined,
    });
  }

  async importDrafts(draftDtos: CreateDraftDto[]): Promise<void> {
    for (const draftDto of draftDtos) {
      await this.create(draftDto);
    }
  }

  async autoSave(id: number, updateDraftDto: UpdateDraftDto): Promise<Draft> {
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

    if (tags !== undefined) {
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

    return new Draft({
      ...updatedDraft,
      tags: updatedDraft.tags ? (JSON.parse(updatedDraft.tags) as string[]) : [],
      pathname: updatedDraft.pathname ?? undefined,
      category: updatedDraft.category ?? undefined,
    });
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
