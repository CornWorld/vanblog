import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, sql, like } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database';
import { tags, articles } from '../../database/schema';
import { OverallStatisticsDto } from '../../shared/dto/statistics.dto';
import { StatisticsService } from '../../shared/services/statistics.service';

import { CreateTagDto, UpdateTagDto, TagListResponseDto } from './dto/tag.dto';
import { Tag } from './entities/tag.entity';

import type { Database } from '../../database/connection';

@Injectable()
export class TagService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly statisticsService: StatisticsService,
  ) {}

  async findAll(): Promise<TagListResponseDto> {
    const tagResults = await this.db.select().from(tags);
    const total = tagResults.length;

    // Count articles for each tag
    const processedTags = await Promise.all(
      tagResults.map(async (tag) => {
        // Count articles that contain this tag
        const countResult = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(articles)
          .where(like(articles.tags, `%"${tag.name}"%`));

        return {
          ...tag,
          slug: tag.slug,
          articleCount: Number(countResult[0]?.count) || 0,
          updatedAt: tag.createdAt, // Use createdAt as updatedAt since tags table doesn't have updatedAt
        };
      }),
    );

    return {
      items: processedTags,
      total: total,
    };
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
    const result = await this.db.insert(tags).values(createTagDto).returning();

    if (result.length === 0) {
      throw new Error('Failed to create tag');
    }

    return new Tag({
      ...result[0],
      slug: result[0].slug ?? undefined,
    });
  }

  async update(id: number, updateTagDto: UpdateTagDto): Promise<Tag> {
    const result = await this.db.update(tags).set(updateTagDto).where(eq(tags.id, id)).returning();

    if (result.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }

    return new Tag({
      ...result[0],
      slug: result[0].slug ?? undefined,
    });
  }

  async remove(id: number): Promise<void> {
    const result = await this.db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });

    if (result.length === 0) {
      throw new NotFoundException(`Tag with ID ${String(id)} not found`);
    }
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
