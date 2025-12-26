import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { drafts, articles, tags } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { eq, and, or, like, desc, asc, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../database';
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
        tags: draft.tags ?? [],
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
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const [draft] = results;

    return {
      ...draft,
      tags: draft.tags ?? [],
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

    let draftData: {
      title: string;
      content: string;
      pathname: null;
      tags: string[] | null;
      category: null;
      author: string;
    } = {
      title: rest.title,
      content: rest.content,
      pathname: null, // pathname not available in CreateDraftDto
      tags: Array.isArray(tags) && tags.length > 0 ? tags : null,
      category: null, // Use first category from categories array if available
      author: 'admin', // Default author since not in CreateDraftDto
    };

    // 触发创建前的插件钩子
    const filteredData = await this.hookService.applyFilters('draft|beforeCreate', draftData, {
      action: 'create',
    });

    // Ensure tags is the correct type after filtering
    draftData = {
      ...filteredData,
      tags:
        Array.isArray(filteredData.tags) && filteredData.tags.length > 0 ? filteredData.tags : null,
    } as typeof draftData;

    const result = await this.db.insert(drafts).values(draftData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create draft');
    }

    const [newDraft] = result;

    const draftResult = {
      ...newDraft,
      tags: newDraft.tags ?? [],
      pathname: newDraft.pathname,
      category: newDraft.category,
      createdAt: dayjs(newDraft.createdAt).format(),
      updatedAt: dayjs(newDraft.updatedAt).format(),
    };

    // 触发创建后的插件钩子
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

    // tags is string[] | null, Drizzle handles JSON serialization automatically
    updateData.tags = tags;

    if ('category' in rest && rest.category !== undefined) {
      updateData.category = rest.category ?? null;
    }

    if ('author' in rest && rest.author !== undefined) {
      updateData.author = rest.author;
    }

    updateData.updatedAt = dayjs().format();

    // 触发更新前的插件钩子
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
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const [updatedDraft] = result;

    const draftResult = {
      ...updatedDraft,
      tags: updatedDraft.tags ?? [],
      pathname: updatedDraft.pathname,
      category: updatedDraft.category,
      createdAt: dayjs(updatedDraft.createdAt).format(),
      updatedAt: dayjs(updatedDraft.updatedAt).format(),
    };

    // 触发更新后的插件钩子
    await this.hookService.doAction('draft|afterUpdate', draftResult, { action: 'update', id });

    return draftResult;
  }

  async remove(id: number): Promise<void> {
    // 首先删除所有版本
    await this.draftVersionService.deleteAllVersions(id);

    // 触发删除前的插件钩子
    await this.hookService.doAction('draft|beforeDelete', { id }, { action: 'delete' });

    const result = await this.db
      .delete(drafts)
      .where(eq(drafts.id, id))
      .returning({ id: drafts.id });

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    // 触发删除后的插件钩子
    await this.hookService.doAction('draft|afterDelete', { id }, { action: 'delete' });
  }

  /**
   * 发布草稿为文章
   *
   * 将草稿转换为正式文章，支持设置密码保护、置顶等选项
   * 发布成功后会自动删除草稿
   *
   * @param id 草稿 ID
   * @param publishDto 发布选项
   * @returns 创建的文章实体
   */
  async publish(id: number, publishDto: z.infer<typeof PublishDraftSchema>): Promise<Article> {
    // First, get the draft
    const draft = await this.findOne(id);
    const draftTags = draft.tags ?? [];

    // Auto-create tags if they don't exist
    if (draftTags.length > 0) {
      await this.createMissingTags(draftTags);
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
          tags: draftTags.length > 0 ? draftTags : null,
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

    // 发布成功，删除原草稿
    await this.remove(id);

    const [newArticle] = createdArticles;

    const articleResult = new Article({
      ...newArticle,
      tags: newArticle.tags ?? [],
      pathname: newArticle.pathname,
      category: newArticle.category,
      author: newArticle.author,
      top: newArticle.top,
      hidden: newArticle.hidden,
      private: newArticle.private,
      password: newArticle.password,
      viewer: newArticle.viewer,
    });

    // 触发发布成功的 webhook 事件
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
      tags: newArticle.tags ?? [],
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

    // tags is string[] | null, Drizzle handles JSON serialization automatically
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
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const [updatedDraft] = result;

    return {
      ...updatedDraft,
      tags: updatedDraft.tags ?? [],
      pathname: updatedDraft.pathname,
      category: updatedDraft.category,
      createdAt: dayjs(updatedDraft.createdAt).format(),
      updatedAt: dayjs(updatedDraft.updatedAt).format(),
    };
  }

  /**
   * 自动创建缺失的标签
   *
   * 在发布草稿时，自动创建数据库中不存在的标签
   *
   * @param tagNames 标签名称数组
   */
  private async createMissingTags(tagNames: string[]): Promise<void> {
    // 获取现有标签
    const existingTags = await this.db.select().from(tags);
    const existingTagNames = new Set(existingTags.map((tag) => tag.name));

    // 找出需要创建的标签
    const missingTags = tagNames.filter((tagName) => !existingTagNames.has(tagName));

    // 批量创建缺失的标签
    if (missingTags.length > 0) {
      const tagsToCreate = missingTags.map((tagName) => ({
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
      }));

      // 确保返回结果，以保持与测试/mock 的一致性
      await this.db.insert(tags).values(tagsToCreate).returning();
    }
  }
}
