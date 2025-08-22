import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, sql, like } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { tags, articles } from '../../database/schema';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { QueryOptimizerService } from '../../shared/services/query-optimizer.service';
import { StatisticsService } from '../../shared/services/statistics.service';
import { HookService } from '../plugin/services/hook.service';

import { CreateTagDto, UpdateTagDto, TagListResponseDto } from './dto/tag.dto';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly statisticsService: StatisticsService,
    private readonly queryOptimizer: QueryOptimizerService,
    private readonly hookService: HookService,
  ) {}

  async findAll(): Promise<TagListResponseDto> {
    return await this.queryOptimizer.withPerformanceMonitoring('TagService.findAll', async () => {
      const tagResults = await this.db.select().from(tags);
      const total = tagResults.length;

      if (total === 0) {
        return {
          items: [],
          total: 0,
        };
      }

      // 批量查询所有标签的文章数量，避免 N+1 查询问题
      const tagNames = tagResults.map((tag) => tag.name);
      const articleCounts = await this.queryOptimizer.batchCountArticlesByTags(this.db, tagNames);

      const processedTags = tagResults.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        articleCount: articleCounts[tag.name] ?? 0,
        createdAt: dayjs(tag.createdAt),
      }));

      return {
        items: processedTags,
        total,
      };
    });
  }

  async findOne(id: number): Promise<Tag> {
    const results = await this.db.select().from(tags).where(eq(tags.id, id)).limit(1);

    if (results.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    return new Tag({
      ...results[0],
      slug: results[0].slug ?? undefined,
    });
  }

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    let tagData = createTagDto;

    // Trigger beforeCreate hook
    try {
      tagData = await this.hookService.applyFilters('tag|beforeCreate', tagData, {
        action: 'create',
      });
    } catch {
      // Hook errors should not break the main flow
    }

    const result = await this.db.insert(tags).values(tagData).returning();

    if (result.length === 0) {
      throw new Error('Failed to create tag');
    }

    const tagResult = new Tag({
      ...result[0],
      slug: result[0].slug ?? undefined,
    });

    // Trigger afterCreate hook
    await this.hookService.doAction('tag|afterCreate', tagResult, {
      action: 'create',
    });

    // Trigger webhook event
    await this.hookService.doAction('tag.created', {
      id: tagResult.id,
      name: tagResult.name,
      slug: tagResult.slug,
      createdAt: tagResult.createdAt,
    });

    return tagResult;
  }

  async update(id: number, updateTagDto: UpdateTagDto): Promise<Tag> {
    let tagData = updateTagDto;

    // Trigger beforeUpdate hook
    tagData = await this.hookService.applyFilters('tag|beforeUpdate', tagData, {
      action: 'update',
      id,
    });

    const result = await this.db.update(tags).set(tagData).where(eq(tags.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    const tagResult = new Tag({
      ...result[0],
      slug: result[0].slug ?? undefined,
    });

    // Trigger afterUpdate hook
    await this.hookService.doAction('tag|afterUpdate', tagResult, {
      action: 'update',
      id,
    });

    // Trigger webhook event
    await this.hookService.doAction('tag.updated', {
      id: tagResult.id,
      name: tagResult.name,
      slug: tagResult.slug,
      updatedAt: tagResult.updatedAt,
    });

    return tagResult;
  }

  async remove(id: number): Promise<void> {
    // Trigger beforeDelete hook
    await this.hookService.doAction(
      'tag|beforeDelete',
      { id },
      {
        action: 'delete',
      },
    );

    const result = await this.db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });

    if (result.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    // Trigger afterDelete hook
    await this.hookService.doAction(
      'tag|afterDelete',
      { id },
      {
        action: 'delete',
      },
    );

    // Trigger webhook event
    await this.hookService.doAction('tag.deleted', { id });
  }

  async getStatistics(): Promise<OverallStatisticsDto> {
    return this.statisticsService.getOverallStatistics();
  }

  async findByName(name: string): Promise<Tag | null> {
    const results = await this.db.select().from(tags).where(eq(tags.name, name)).limit(1);

    if (results.length === 0) {
      return null;
    }

    return new Tag({
      ...results[0],
      slug: results[0].slug ?? undefined,
    });
  }

  async findOrCreateTags(tagNames: string[]): Promise<Tag[]> {
    const existingTags = await this.db.select().from(tags);
    const existingTagNames = new Set(existingTags.map((tag) => tag.name));

    const missingTags = tagNames.filter((tagName) => !existingTagNames.has(tagName));

    if (missingTags.length > 0) {
      const tagsToCreate = missingTags.map((tagName) => ({
        name: tagName,
        slug: tagName.toLowerCase().replace(/\s+/g, '-'),
      }));

      await this.db.insert(tags).values(tagsToCreate);
    }

    const allTags = await this.db
      .select()
      .from(tags)
      .where(
        sql`${tags.name} IN (${sql.join(
          tagNames.map((name) => sql`${name}`),
          sql`, `,
        )})`,
      );

    return allTags.map(
      (tag) =>
        new Tag({
          ...tag,
          slug: tag.slug ?? undefined,
        }),
    );
  }

  async getTagsWithCategories(): Promise<
    {
      tag: Tag;
      categories: { name: string; count: number }[];
    }[]
  > {
    const tagList = await this.db.select().from(tags);

    const results = await Promise.all(
      tagList.map(async (tag) => {
        const categoryStats = await this.db
          .select({
            category: articles.category,
            count: sql<number>`count(*)`,
          })
          .from(articles)
          .where(like(articles.tags, `%"${tag.name}"%`))
          .groupBy(articles.category);

        return {
          tag: new Tag({
            ...tag,
            slug: tag.slug ?? undefined,
          }),
          categories: categoryStats
            .filter((stat) => stat.category !== null)
            .map((stat) => ({
              name: stat.category as string,
              count: Number(stat.count),
            })),
        };
      }),
    );

    return results;
  }
}
