import { Inject, Injectable } from '@nestjs/common';
import {
  toTimelineArticleInputFromDb,
  decodeTimelineArticle,
  encodeTimelineArticle,
  type TimelineArticleInput,
  type TimelineArticleDbRow,
} from '@vanblog/shared';
import { articles } from '@vanblog/shared/drizzle';
import { and, desc, eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';

@Injectable()
export class TimelineService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  /**
   * 获取按年份聚合的文章时间线
   *
   * 根据文章的创建时间，将文章按年份进行分组聚合。
   * 默认只返回公开的文章（非隐藏且非私密）。
   *
   * @param includeHidden 是否包含隐藏文章（默认为 false）
   * @returns 按年份分组的文章列表，键为年份字符串，值为该年份的文章数组
   */
  async getTimeline(includeHidden = false): Promise<Record<string, TimelineArticleInput[]>> {
    // 过滤条件：隐藏文章默认不包含；私有文章始终不包含
    const where = includeHidden
      ? eq(articles.private, false)
      : and(eq(articles.hidden, false), eq(articles.private, false));

    // 按创建时间降序查询文章的必要字段
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
      // 使用 createdAt 作为 pubTime 的回退值（因为该列尚未迁移）
      const dbRow: TimelineArticleDbRow = {
        ...row,
        pubTime: row.createdAt,
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
