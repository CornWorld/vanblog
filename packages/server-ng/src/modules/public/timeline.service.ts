import { Inject, Injectable } from '@nestjs/common';
import {
  toTimelineArticleInputFromDb,
  decodeTimelineArticle,
  encodeTimelineArticle,
  type TimelineArticleInput,
  type TimelineArticleDbRow,
} from '@vanblog/shared';
import { and, desc, eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { articles } from '../../database/schema';

// tags parsing moved into shared helper

// 使用本地类型，后续迁移到 shared

@Injectable()
export class TimelineService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  // 获取按年份聚合的文章时间线（仅公开文章）
  async getTimeline(includeHidden = false): Promise<Record<string, TimelineArticleInput[]>> {
    // 过滤条件：隐藏文章默认不包含；私有文章不包含
    const where = includeHidden
      ? eq(articles.private, false)
      : and(eq(articles.hidden, false), eq(articles.private, false));

    // 先按创建时间降序取出必要字段
    const rows = await this.db
      .select({
        id: articles.id,
        title: articles.title,
        pathname: articles.pathname,
        tags: articles.tags,
        category: articles.category,
        author: articles.author,
        top: articles.top,
        hidden: articles.hidden,
        private: articles.private,
        viewer: articles.viewer,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .where(where)
      .orderBy(desc(articles.createdAt));

    // 聚合到 Map 后再转对象，避免 undefined union 与类型断言
    const buckets = new Map<string, TimelineArticleInput[]>();

    for (const row of rows) {
      // Use createdAt as fallback for pubTime since the column doesn't exist yet
      const dbRow: TimelineArticleDbRow = {
        ...row,
        pubTime: row.createdAt, // fallback to createdAt
      };
      const input = toTimelineArticleInputFromDb(dbRow);
      const decoded = decodeTimelineArticle(input);
      const year = decoded.createdAt.year().toString();
      const item = encodeTimelineArticle(decoded);

      const arr = buckets.get(year) ?? [];
      arr.push(item);
      buckets.set(year, arr);
    }

    return Object.fromEntries(buckets) as Record<string, TimelineArticleInput[]>;
  }
}
