import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { CreateTagDto, UpdateTagDto, TagListResponseDto } from './dto/tag.dto';
import { tags } from '../../db/schema';
import { DATABASE_CONNECTION } from '../../database/database.module';
import type { Database } from '../../db/connection';
import { Tag } from './entities/tag.entity';

@Injectable()
export class TagService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async findAll(): Promise<TagListResponseDto> {
    const tagResults = await this.db.select().from(tags);
    const total = tagResults.length;

    const processedTags = tagResults.map((tag) => ({
      ...tag,
      slug: tag.slug ?? undefined,
      articleCount: 0, // For now, we don't count articles
    }));

    return {
      data: processedTags,
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
}
