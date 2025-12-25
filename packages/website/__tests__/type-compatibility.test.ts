import { describe, it, expect } from 'vitest';
import type { Article } from '../types/article';
import type { ArticleDetail, ApiV2Response, PaginatedData } from '../types/api';

describe('Type Compatibility Tests', () => {
  it('should handle Article with number id', () => {
    const article: Article = {
      id: 123,
      title: 'Test Article',
      content: 'Test article content',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      category: 'tech',
      tags: ['test'],
      private: false,
      author: 'Test Author',
      top: 0,
      hidden: false,
      viewer: 100,
      date: '2024-01-01T00:00:00Z',
      hide: false,
    };

    expect(typeof article.id).toBe('number');
    expect(article.id).toBe(123);
  });

  it('should handle ArticleDetail extending Article', () => {
    const articleDetail: ArticleDetail = {
      id: 456,
      title: 'Test Article Detail',
      content: 'Test content',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      category: 'tech',
      tags: ['test'],
      private: false,
      author: 'Test Author',
      top: 0,
      hidden: false,
      viewer: 100,
      date: '2024-01-01T00:00:00Z',
      hide: false,
      toc: 'Table of contents',
      next: { id: 457, title: 'Next Article' },
      prev: { id: 455, title: 'Previous Article' },
    };

    expect(typeof articleDetail.id).toBe('number');
    expect(typeof articleDetail.next?.id).toBe('number');
    expect(typeof articleDetail.prev?.id).toBe('number');
  });

  it('should handle v2 API response format', () => {
    const v2Response: ApiV2Response<PaginatedData<Article>> = {
      statusCode: 200,
      data: {
        items: [
          {
            id: 789,
            title: 'Test Article in V2',
            content: 'Test content for v2',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            category: 'tech',
            tags: ['test'],
            private: false,
            author: 'Test Author',
            top: 0,
            hidden: false,
            viewer: 100,
            date: '2024-01-01T00:00:00Z',
            hide: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      },
    };

    expect(v2Response.statusCode).toBe(200);
    expect(v2Response.data.items).toHaveLength(1);
    expect(typeof v2Response.data.items[0].id).toBe('number');
  });

  it('should handle id conversion for URLs', () => {
    const article: Article = {
      id: 999,
      title: 'URL Test Article',
      content: 'URL test content',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      category: 'tech',
      tags: ['test'],
      private: false,
      author: 'Test Author',
      top: 0,
      hidden: false,
      viewer: 100,
      date: '2024-01-01T00:00:00Z',
      hide: false,
    };

    // Test that id can be converted to string for URLs
    const urlId = article.id.toString();
    expect(urlId).toBe('999');
    expect(typeof urlId).toBe('string');
  });
});
