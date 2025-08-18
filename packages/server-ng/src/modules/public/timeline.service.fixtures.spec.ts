import { describe, expect } from 'vitest';

import { test } from '../../../test/vitest-fixtures.test';

import { TimelineService } from './timeline.service';

// 扩展测试上下文，提供 TimelineService 实例
const timelineTest = test.extend<{ timelineService: TimelineService }>({
  timelineService: async ({ db }, use) => {
    const service = new TimelineService(db as any);
    await use(service);
  },
});

describe('TimelineService', () => {
  timelineTest(
    'should return empty result when no articles',
    async ({ timelineService, databaseMock }) => {
      databaseMock.setQueryResult([]);

      const result = await timelineService.getTimeline();

      expect(result).toEqual({});
    },
  );

  timelineTest(
    'should group articles by year and parse fields correctly',
    async ({ timelineService, databaseMock }) => {
      const rows = [
        {
          id: 1,
          title: 'NestJS Tips',
          pathname: '/posts/nestjs-tips',
          tags: JSON.stringify(['nestjs', 'ts']),
          category: 'Tech',
          author: 'alice',
          top: false,
          hidden: false,
          private: false,
          viewer: 5,
          createdAt: new Date('2024-06-01T00:00:00Z'),
          updatedAt: new Date('2024-06-02T00:00:00Z'),
        },
        {
          id: 2,
          title: 'Life Note',
          pathname: '/posts/life-note',
          tags: 'invalid-json',
          category: 'Life',
          author: 'bob',
          top: false,
          hidden: false,
          private: false,
          viewer: null,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-02T00:00:00Z'),
        },
      ];

      databaseMock.setQueryResult(rows);

      const result = await timelineService.getTimeline();

      expect(Object.keys(result)).toEqual(expect.arrayContaining(['2024', '2023']));
      expect(result['2024']).toHaveLength(1);
      expect(result['2023']).toHaveLength(1);

      const [a2024] = result['2024'];
      expect(a2024.tags).toEqual(['nestjs', 'ts']);
      expect(a2024.viewer).toBe(5);
      expect(a2024.hidden).toBe(false);
      expect(a2024.private).toBe(false);

      const [a2023] = result['2023'];
      expect(a2023.tags).toEqual([]); // 无效JSON回退为空数组
      expect(a2023.viewer).toBe(0); // null 回退为 0
    },
  );

  timelineTest(
    'should respect includeHidden flag (exclude hidden by default, include when true)',
    async ({ timelineService, databaseMock }) => {
      const publicOnly = [
        {
          id: 10,
          title: 'Public',
          pathname: '/p',
          tags: '[]',
          category: 'C1',
          author: 'u',
          top: false,
          hidden: false,
          private: false,
          viewer: 0,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z'),
        },
      ];

      // 默认：应只返回公开非隐藏文章（模拟数据库过滤结果）
      databaseMock.setQueryResult(publicOnly);
      const r1 = await timelineService.getTimeline(false);
      expect(Object.keys(r1)).toEqual(['2024']);
      expect(r1['2024']).toHaveLength(1);
      expect(r1['2024'][0].id).toBe(10);

      const publicAndHidden = [
        ...publicOnly,
        {
          id: 11,
          title: 'Hidden But Public',
          pathname: '/h',
          tags: '[]',
          category: 'C1',
          author: 'u',
          top: false,
          hidden: true,
          private: false,
          viewer: 0,
          createdAt: new Date('2024-02-01T00:00:00Z'),
          updatedAt: new Date('2024-02-01T00:00:00Z'),
        },
      ];

      // includeHidden=true：应包含隐藏但非私有文章（模拟数据库过滤结果）
      databaseMock.setQueryResult(publicAndHidden);
      const r2 = await timelineService.getTimeline(true);
      expect(Object.keys(r2)).toEqual(['2024']);
      expect(r2['2024']).toHaveLength(2);
      const ids2024 = r2['2024'].map((a) => a.id);
      expect(ids2024).toEqual(expect.arrayContaining([10, 11]));
    },
  );
});
