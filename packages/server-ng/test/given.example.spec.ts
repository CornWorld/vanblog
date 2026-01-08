/**
 * Given 模式使用示例
 *
 * 对比传统方式和 Given 模式的差异
 */

import { Test } from '@nestjs/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { Given } from './given';
import { db } from './setup.unit';
import { withTestTransaction } from './utils/db-transaction-helper';
import { ArticleService } from '../src/modules/article/article.service';
import { DATABASE_CONNECTION } from '../src/database';
import { Mock } from './mock';
import { QueryOptimizerService } from '../src/modules/shared/services/query-optimizer.service';

describe('Given 模式示例', () => {
  let service: ArticleService;

  beforeEach(async () => {
    const mockHookService = Mock.hook();
    const mockQueryOptimizer = Mock.queryOptimizer();
    const mockConfigService = Mock.config();

    const module = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: 'HookService', useValue: mockHookService },
        { provide: QueryOptimizerService, useValue: mockQueryOptimizer },
        { provide: 'ConfigService', useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  // ========== 旧方式示例（已弃用，仅供参考） ==========
  describe('旧方式示例（已弃用）', () => {
    it('should create article', async () => {
      // ⚠️ 以下代码展示旧方式，仅供对比参考，不推荐使用
      /*
      await withTestTransaction(db, async (tx) => {
        service['db'] = tx;

        // 创建用户（10 行）
        await tx.insert(users).values({
          id: 1,
          username: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          type: 'admin',
          password: 'hashed-password',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // 创建分类（5 行）
        await tx.insert(categories).values({
          name: 'Tech',
          slug: 'tech',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // 创建文章（10+ 行，需要格式转换）
        await tx.insert(articles).values({
          ...toDbArticle(Mock.article()),
          id: 1,
          title: 'Test',
          author: '1',
          category: 'Tech',
        });

        const result = await service.create({ title: 'Test' });
        expect(result.title).toBe('Test');
      });
      */

      // ✅ 推荐使用 Given 模式（见下方测试）
      await Given.article({ title: 'Test' });
      const result = await service.create({ title: 'Test' });
      expect(result.title).toBe('Test');
    });
  });

  // ========== Given 模式（5 行） ==========
  describe('Given 模式', () => {
    it('should create article', async () => {
      // 一行代码创建测试数据（自动处理 user、category 依赖）
      await Given.article({ title: 'Test' });

      const result = await service.create({ title: 'Test' });
      expect(result.title).toBe('Test');
    });
  });

  // ========== 更多示例 ==========
  describe('Given 模式 - 更多功能', () => {
    it('should create article with custom fields', async () => {
      // 自定义字段
      await Given.article({
        id: 100,
        title: 'Custom Title',
        category: 'Tech',
        author: 2,
        private: true,
      });

      const result = await service.findOne(100);
      expect(result.title).toBe('Custom Title');
      expect(result.private).toBe(true);
    });

    it('should create multiple articles', async () => {
      // 批量创建 10 篇文章
      await Given.articles(10);

      const result = await service.findAll({ page: 1, pageSize: 10 });
      expect(result.total).toBe(10);
    });

    it('should create articles with same category', async () => {
      // 批量创建同一分类的文章
      await Given.articles(5, { category: 'Tech' });

      const result = await service.findByCategory('Tech');
      expect(result).toHaveLength(5);
    });

    it('should work with complex scenarios', async () => {
      // 创建不同类型的文章
      await Given.article({ title: 'Public Article', private: false });
      await Given.article({ title: 'Private Article', private: true });
      await Given.article({ title: 'Tech Article', category: 'Tech' });

      // 测试逻辑...
      const publicArticles = await service.findPublic();
      const privateArticles = await service.findPrivate();
      const techArticles = await service.findByCategory('Tech');

      expect(publicArticles).toHaveLength(1);
      expect(privateArticles).toHaveLength(1);
      expect(techArticles).toHaveLength(1);
    });
  });

  // ========== Media 文件示例 ==========
  describe('Given.media() - 媒体文件', () => {
    it('should create media file with defaults', async () => {
      const media = await Given.media();

      expect(media).toBeDefined();
      expect(media.id).toBeDefined();
      expect(media.filename).toBe('test.jpg');
      expect(media.path).toBe('/uploads/images/test.jpg');
      expect(media.size).toBe(1024);
      expect(media.mimeType).toBe('image/jpeg');
    });

    it('should create media file with custom fields', async () => {
      const media = await Given.media({
        filename: 'custom-image.png',
        path: '/uploads/images/custom-image.png',
        mimeType: 'image/png',
        width: 800,
        height: 600,
        size: 51200,
      });

      expect(media.filename).toBe('custom-image.png');
      expect(media.path).toBe('/uploads/images/custom-image.png');
      expect(media.mimeType).toBe('image/png');
      expect(media.width).toBe(800);
      expect(media.height).toBe(600);
      expect(media.size).toBe(51200);
    });

    it('should create media file for cloud storage', async () => {
      const media = await Given.media({
        filename: 'remote.pdf',
        path: 'https://oss.example.com/bucket/remote.pdf',
        provider: 'oss',
        size: 2048576, // 2MB
        mimeType: 'application/pdf',
      });

      expect(media.filename).toBe('remote.pdf');
      expect(media.provider).toBe('oss');
      expect(media.size).toBe(2048576);
      expect(media.mimeType).toBe('application/pdf');
    });
  });
});
