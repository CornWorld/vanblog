import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION } from '../../database';
import { articles } from '../../database/schema';
import { safeParseJson, dataSchemas } from '../../shared/zod';

import { TimelineArticleSchema } from './dto/timeline.dto';

import type { Database } from '../../database/connection';

// 使用 Zod 推导出 TimelineArticle 的 TS 类型
export type TimelineArticle = z.infer<typeof TimelineArticleSchema>;

@Injectable()
export class TimelineService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  // 获取按年份聚合的文章时间线（仅公开文章）
  async getTimeline(includeHidden = false): Promise<Record<string, TimelineArticle[]>> {
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

    // 聚合为 { year: Article[] }
    const result: Record<string, TimelineArticle[] | undefined> = {};

    for (const row of rows) {
      const year = dayjs(row.createdAt).year().toString();
      const item: TimelineArticle = {
        id: row.id,
        title: row.title,
        pathname: row.pathname,
        tags: safeParseJson(row.tags, dataSchemas.tagsArray) ?? [],
        category: row.category,
        author: row.author,
        top: row.top,
        hidden: !!row.hidden,
        private: !!row.private,
        viewer: row.viewer ?? 0,
        createdAt: dayjs(row.createdAt).toDate(),
        updatedAt: dayjs(row.updatedAt).toDate(),
      };

      result[year] ??= [];
      result[year].push(item);
    }

    return result as Record<string, TimelineArticle[]>;
  }
}
