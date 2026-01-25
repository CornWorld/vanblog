import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { drafts, articles, tags, draftTags } from '@vanblog/shared/drizzle';
import * as bcrypt from 'bcrypt';
import { eq, and, or, like, desc, asc, sql, inArray } from 'drizzle-orm';
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

  /**
   * 加载草稿的标签（从 draft_tags 关联表）
   *
   * @param draftId 草稿 ID
   * @returns 标签名称数组
   */
  private async loadDraftTags(draftId: number): Promise<string[]> {
    const tagResults = await this.db
      .select({ tagName: draftTags.tagName })
      .from(draftTags)
      .where(eq(draftTags.draftId, draftId));

    return tagResults.map((t) => t.tagName);
  }

  /**
   * 批量加载多个草稿的标签（性能优化）
   *
   * @param draftIds 草稿 ID 数组
   * @returns Map<draftId, tagNames[]>
   */
  private async loadDraftTagsBatch(draftIds: number[]): Promise<Map<number, string[]>> {
    if (draftIds.length === 0) {
      return new Map();
    }

    const tagResults = await this.db
      .select({
        draftId: draftTags.draftId,
        tagName: draftTags.tagName,
      })
      .from(draftTags)
      .where(inArray(draftTags.draftId, draftIds));

    const tagMap = new Map<number, string[]>();
    for (const result of tagResults) {
      const existing = tagMap.get(result.draftId) ?? [];
      existing.push(result.tagName);
      tagMap.set(result.draftId, existing);
    }

    return tagMap;
  }

  /**
   * 更新草稿的标签关联（删除旧的，插入新的）
   *
   * @param draftId 草稿 ID
   * @param tagNames 新的标签名称数组
   */
  private async updateDraftTags(draftId: number, tagNames: string[]): Promise<void> {
    // 1. 删除旧的标签关联
    await this.db.delete(draftTags).where(eq(draftTags.draftId, draftId));

    // 2. 确保所有标签存在（自动创建缺失的标签）
    if (tagNames.length > 0) {
      // 获取现有标签
      const existingTags = await this.db.select().from(tags);
      const existingTagNames = new Set(existingTags.map((tag) => tag.name));

      // 找出需要创建的标签
      const missingTags = tagNames.filter((tagName) => !existingTagNames.has(tagName));

      // 批量创建缺失的标签
      if (missingTags.length > 0) {
        await this.db.insert(tags).values(
          missingTags.map((tagName) => ({
            name: tagName,
            slug: tagName.toLowerCase().replace(/\s+/g, '-'),
            createdAt: dayjs().format(),
          })),
        );
      }

      // 3. 插入新的标签关联
      await this.db.insert(draftTags).values(
        tagNames.map((tagName) => ({
          draftId,
          tagName,
          createdAt: dayjs().format(),
        })),
      );
    }
  }

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

    // 批量加载标签（性能优化：一次查询获取所有标签）
    const draftIds = draftResults.map((d) => d.id);
    const tagsMap = await this.loadDraftTagsBatch(draftIds);

    return {
      items: draftResults.map((draft) => ({
        id: draft.id,
        title: draft.title,
        content: draft.content,
        pathname: draft.pathname,
        category: draft.category,
        tags: tagsMap.get(draft.id) ?? [],
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

    // 从 draft_tags 关联表加载标签
    const tags = await this.loadDraftTags(draft.id);

    return {
      ...draft,
      tags,
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

    // 提取标签数组（用于后续写入关联表）
    const tagNames = Array.isArray(tags) && tags.length > 0 ? tags : [];

    const draftData: {
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
      tags: tagNames.length > 0 ? tagNames : null, // 保留用于钩子
      category: null, // Use first category from categories array if available
      author: 'admin', // Default author since not in CreateDraftDto
    };

    // 触发创建前的插件钩子
    const filteredData = await this.hookService.applyFilters('draft|beforeCreate', draftData, {
      action: 'create',
    });

    // Ensure tags is the correct type after filtering
    const filteredTags =
      Array.isArray(filteredData.tags) && filteredData.tags.length > 0 ? filteredData.tags : [];

    // 插入草稿（不再写入 tags 字段）
    const insertData = {
      ...filteredData,
      tags: null, // 不再使用 JSON 字段
    };

    const result = await this.db.insert(drafts).values(insertData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create draft');
    }

    const [newDraft] = result;

    // 写入标签关联表
    if (filteredTags.length > 0) {
      await this.updateDraftTags(newDraft.id, filteredTags);
    }

    const draftResult = {
      ...newDraft,
      tags: filteredTags,
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

    // 保留 tags 用于钩子，但不写入数据库
    if (tags !== undefined) {
      updateData.tags = tags;
    }

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

    // 提取钩子处理后的标签
    const finalTags = updateData.tags as string[] | undefined;

    // 移除 tags 字段（不再写入 JSON 列）
    const { tags: _tags, ...dbUpdateData } = updateData;

    const result = await this.db
      .update(drafts)
      .set(dbUpdateData)
      .where(eq(drafts.id, id))
      .returning();

    if (result.length === 0) {
      throw new NotFoundException(`Draft with ID ${String(id)} not found`);
    }

    const [updatedDraft] = result;

    // 更新标签关联表
    if (finalTags != null) {
      await this.updateDraftTags(id, finalTags);
    }

    // 从关联表加载最新标签
    const currentTags = await this.loadDraftTags(id);

    const draftResult = {
      ...updatedDraft,
      tags: currentTags,
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
    // Filter out null/undefined values from tags array
    const draftTags = Array.isArray(draft.tags) ? draft.tags.filter((tag) => tag) : [];

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

    // 更新标签关联表（如果提供了 tags）
    if (tags !== undefined) {
      await this.updateDraftTags(id, tags ?? []);
    }

    // 从关联表加载最新标签
    const currentTags = await this.loadDraftTags(id);

    return {
      ...updatedDraft,
      tags: currentTags,
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

    // 找出需要创建的标签（过滤掉 null/undefined）
    const missingTags = tagNames.filter((tagName) => tagName && !existingTagNames.has(tagName));

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
