import { describe, it, expect } from 'vitest';
import { CategoryStatisticsDto, TagStatisticsDto, OverallStatisticsDto } from './statistics.dto';

describe('CategoryStatisticsDto', () => {
  describe('instantiation', () => {
    it('should create a valid instance with required fields', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = 'Technology';
      dto.articleCount = 10;
      dto.publishedCount = 8;
      dto.privateCount = 2;
      dto.totalViews = 1500;

      expect(dto.id).toBe(1);
      expect(dto.name).toBe('Technology');
      expect(dto.articleCount).toBe(10);
      expect(dto.publishedCount).toBe(8);
      expect(dto.privateCount).toBe(2);
      expect(dto.totalViews).toBe(1500);
    });

    it('should allow optional slug field to be undefined', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = 'Technology';
      dto.articleCount = 10;
      dto.publishedCount = 8;
      dto.privateCount = 2;
      dto.totalViews = 1500;

      expect(dto.slug).toBeUndefined();
    });

    it('should allow optional slug field to be null', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = 'Technology';
      dto.slug = null;
      dto.articleCount = 10;
      dto.publishedCount = 8;
      dto.privateCount = 2;
      dto.totalViews = 1500;

      expect(dto.slug).toBeNull();
    });

    it('should allow optional slug field to be a string', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = 'Technology';
      dto.slug = 'technology';
      dto.articleCount = 10;
      dto.publishedCount = 8;
      dto.privateCount = 2;
      dto.totalViews = 1500;

      expect(dto.slug).toBe('technology');
    });
  });

  describe('edge cases', () => {
    it('should handle zero counts', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = 'Empty Category';
      dto.articleCount = 0;
      dto.publishedCount = 0;
      dto.privateCount = 0;
      dto.totalViews = 0;

      expect(dto.articleCount).toBe(0);
      expect(dto.publishedCount).toBe(0);
      expect(dto.privateCount).toBe(0);
      expect(dto.totalViews).toBe(0);
    });

    it('should handle large numbers', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 999999;
      dto.name = 'Popular Category';
      dto.articleCount = 1000000;
      dto.publishedCount = 900000;
      dto.privateCount = 100000;
      dto.totalViews = 50000000;

      expect(dto.id).toBe(999999);
      expect(dto.articleCount).toBe(1000000);
      expect(dto.publishedCount).toBe(900000);
      expect(dto.privateCount).toBe(100000);
      expect(dto.totalViews).toBe(50000000);
    });

    it('should handle special characters in name', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = 'Tech & Science (2024) - 人工智能';
      dto.articleCount = 5;
      dto.publishedCount = 5;
      dto.privateCount = 0;
      dto.totalViews = 100;

      expect(dto.name).toBe('Tech & Science (2024) - 人工智能');
    });

    it('should handle empty string as name', () => {
      const dto = new CategoryStatisticsDto();
      dto.id = 1;
      dto.name = '';
      dto.articleCount = 0;
      dto.publishedCount = 0;
      dto.privateCount = 0;
      dto.totalViews = 0;

      expect(dto.name).toBe('');
    });
  });
});

describe('TagStatisticsDto', () => {
  describe('instantiation', () => {
    it('should create a valid instance with required fields', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = 'TypeScript';
      dto.articleCount = 25;
      dto.totalViews = 3500;

      expect(dto.id).toBe(1);
      expect(dto.name).toBe('TypeScript');
      expect(dto.articleCount).toBe(25);
      expect(dto.totalViews).toBe(3500);
    });

    it('should allow optional slug field to be undefined', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = 'TypeScript';
      dto.articleCount = 25;
      dto.totalViews = 3500;

      expect(dto.slug).toBeUndefined();
    });

    it('should allow optional slug field to be null', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = 'TypeScript';
      dto.slug = null;
      dto.articleCount = 25;
      dto.totalViews = 3500;

      expect(dto.slug).toBeNull();
    });

    it('should allow optional slug field to be a string', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = 'TypeScript';
      dto.slug = 'typescript';
      dto.articleCount = 25;
      dto.totalViews = 3500;

      expect(dto.slug).toBe('typescript');
    });
  });

  describe('edge cases', () => {
    it('should handle zero counts', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = 'Unused Tag';
      dto.articleCount = 0;
      dto.totalViews = 0;

      expect(dto.articleCount).toBe(0);
      expect(dto.totalViews).toBe(0);
    });

    it('should handle large numbers', () => {
      const dto = new TagStatisticsDto();
      dto.id = 999999;
      dto.name = 'Popular Tag';
      dto.articleCount = 500000;
      dto.totalViews = 25000000;

      expect(dto.id).toBe(999999);
      expect(dto.articleCount).toBe(500000);
      expect(dto.totalViews).toBe(25000000);
    });

    it('should handle special characters in name', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = 'Vue.js & React - 前端框架';
      dto.articleCount = 15;
      dto.totalViews = 800;

      expect(dto.name).toBe('Vue.js & React - 前端框架');
    });

    it('should handle Unicode emoji in name', () => {
      const dto = new TagStatisticsDto();
      dto.id = 1;
      dto.name = '🚀 Performance';
      dto.articleCount = 10;
      dto.totalViews = 500;

      expect(dto.name).toBe('🚀 Performance');
    });
  });
});

describe('OverallStatisticsDto', () => {
  describe('instantiation', () => {
    it('should create a valid instance with all fields', () => {
      const categories: CategoryStatisticsDto[] = [
        Object.assign(new CategoryStatisticsDto(), {
          id: 1,
          name: 'Tech',
          slug: 'tech',
          articleCount: 10,
          publishedCount: 8,
          privateCount: 2,
          totalViews: 1500,
        }),
      ];

      const tags: TagStatisticsDto[] = [
        Object.assign(new TagStatisticsDto(), {
          id: 1,
          name: 'TypeScript',
          slug: 'typescript',
          articleCount: 25,
          totalViews: 3500,
        }),
      ];

      const dto = new OverallStatisticsDto();
      dto.totalCategories = 5;
      dto.totalTags = 15;
      dto.totalArticles = 100;
      dto.publishedArticles = 80;
      dto.privateArticles = 10;
      dto.hiddenArticles = 10;
      dto.totalViews = 50000;
      dto.categories = categories;
      dto.tags = tags;

      expect(dto.totalCategories).toBe(5);
      expect(dto.totalTags).toBe(15);
      expect(dto.totalArticles).toBe(100);
      expect(dto.publishedArticles).toBe(80);
      expect(dto.privateArticles).toBe(10);
      expect(dto.hiddenArticles).toBe(10);
      expect(dto.totalViews).toBe(50000);
      expect(dto.categories).toHaveLength(1);
      expect(dto.tags).toHaveLength(1);
    });

    it('should handle empty categories and tags arrays', () => {
      const dto = new OverallStatisticsDto();
      dto.totalCategories = 0;
      dto.totalTags = 0;
      dto.totalArticles = 0;
      dto.publishedArticles = 0;
      dto.privateArticles = 0;
      dto.hiddenArticles = 0;
      dto.totalViews = 0;
      dto.categories = [];
      dto.tags = [];

      expect(dto.categories).toEqual([]);
      expect(dto.tags).toEqual([]);
    });

    it('should handle multiple categories and tags', () => {
      const categories: CategoryStatisticsDto[] = [
        Object.assign(new CategoryStatisticsDto(), {
          id: 1,
          name: 'Tech',
          articleCount: 10,
          publishedCount: 8,
          privateCount: 2,
          totalViews: 1500,
        }),
        Object.assign(new CategoryStatisticsDto(), {
          id: 2,
          name: 'Science',
          articleCount: 15,
          publishedCount: 12,
          privateCount: 3,
          totalViews: 2000,
        }),
        Object.assign(new CategoryStatisticsDto(), {
          id: 3,
          name: 'Art',
          articleCount: 5,
          publishedCount: 5,
          privateCount: 0,
          totalViews: 500,
        }),
      ];

      const tags: TagStatisticsDto[] = [
        Object.assign(new TagStatisticsDto(), {
          id: 1,
          name: 'TypeScript',
          articleCount: 25,
          totalViews: 3500,
        }),
        Object.assign(new TagStatisticsDto(), {
          id: 2,
          name: 'JavaScript',
          articleCount: 30,
          totalViews: 4000,
        }),
        Object.assign(new TagStatisticsDto(), {
          id: 3,
          name: 'Node.js',
          articleCount: 20,
          totalViews: 2500,
        }),
      ];

      const dto = new OverallStatisticsDto();
      dto.totalCategories = 3;
      dto.totalTags = 3;
      dto.totalArticles = 30;
      dto.publishedArticles = 25;
      dto.privateArticles = 5;
      dto.hiddenArticles = 0;
      dto.totalViews = 4000;
      dto.categories = categories;
      dto.tags = tags;

      expect(dto.categories).toHaveLength(3);
      expect(dto.tags).toHaveLength(3);
      expect(dto.categories[0].name).toBe('Tech');
      expect(dto.categories[1].name).toBe('Science');
      expect(dto.categories[2].name).toBe('Art');
      expect(dto.tags[0].name).toBe('TypeScript');
      expect(dto.tags[1].name).toBe('JavaScript');
      expect(dto.tags[2].name).toBe('Node.js');
    });
  });

  describe('edge cases', () => {
    it('should handle all zero statistics', () => {
      const dto = new OverallStatisticsDto();
      dto.totalCategories = 0;
      dto.totalTags = 0;
      dto.totalArticles = 0;
      dto.publishedArticles = 0;
      dto.privateArticles = 0;
      dto.hiddenArticles = 0;
      dto.totalViews = 0;
      dto.categories = [];
      dto.tags = [];

      expect(dto.totalCategories).toBe(0);
      expect(dto.totalTags).toBe(0);
      expect(dto.totalArticles).toBe(0);
      expect(dto.publishedArticles).toBe(0);
      expect(dto.privateArticles).toBe(0);
      expect(dto.hiddenArticles).toBe(0);
      expect(dto.totalViews).toBe(0);
    });

    it('should handle very large statistics', () => {
      const dto = new OverallStatisticsDto();
      dto.totalCategories = 10000;
      dto.totalTags = 50000;
      dto.totalArticles = 1000000;
      dto.publishedArticles = 900000;
      dto.privateArticles = 50000;
      dto.hiddenArticles = 50000;
      dto.totalViews = 100000000;
      dto.categories = [];
      dto.tags = [];

      expect(dto.totalCategories).toBe(10000);
      expect(dto.totalTags).toBe(50000);
      expect(dto.totalArticles).toBe(1000000);
      expect(dto.publishedArticles).toBe(900000);
      expect(dto.privateArticles).toBe(50000);
      expect(dto.hiddenArticles).toBe(50000);
      expect(dto.totalViews).toBe(100000000);
    });

    it('should validate article counts sum correctly', () => {
      const dto = new OverallStatisticsDto();
      dto.totalArticles = 100;
      dto.publishedArticles = 70;
      dto.privateArticles = 20;
      dto.hiddenArticles = 10;
      dto.totalCategories = 5;
      dto.totalTags = 10;
      dto.totalViews = 5000;
      dto.categories = [];
      dto.tags = [];

      // Sum of published + private + hidden should equal total
      expect(dto.publishedArticles + dto.privateArticles + dto.hiddenArticles).toBe(
        dto.totalArticles,
      );
    });

    it('should handle mismatch between totalCategories and categories array length', () => {
      const categories: CategoryStatisticsDto[] = [
        Object.assign(new CategoryStatisticsDto(), {
          id: 1,
          name: 'Tech',
          articleCount: 10,
          publishedCount: 8,
          privateCount: 2,
          totalViews: 1500,
        }),
        Object.assign(new CategoryStatisticsDto(), {
          id: 2,
          name: 'Science',
          articleCount: 15,
          publishedCount: 12,
          privateCount: 3,
          totalViews: 2000,
        }),
      ];

      const dto = new OverallStatisticsDto();
      dto.totalCategories = 5; // Different from actual array length
      dto.totalTags = 0;
      dto.totalArticles = 25;
      dto.publishedArticles = 20;
      dto.privateArticles = 5;
      dto.hiddenArticles = 0;
      dto.totalViews = 3500;
      dto.categories = categories;
      dto.tags = [];

      // This is valid - totalCategories might represent total in DB, while categories array is paginated
      expect(dto.totalCategories).toBe(5);
      expect(dto.categories).toHaveLength(2);
    });
  });

  describe('data integrity', () => {
    it('should preserve reference to category and tag arrays', () => {
      const categories: CategoryStatisticsDto[] = [];
      const tags: TagStatisticsDto[] = [];

      const dto = new OverallStatisticsDto();
      dto.totalCategories = 0;
      dto.totalTags = 0;
      dto.totalArticles = 0;
      dto.publishedArticles = 0;
      dto.privateArticles = 0;
      dto.hiddenArticles = 0;
      dto.totalViews = 0;
      dto.categories = categories;
      dto.tags = tags;

      expect(dto.categories).toBe(categories);
      expect(dto.tags).toBe(tags);
    });

    it('should handle categories with null slugs', () => {
      const categories: CategoryStatisticsDto[] = [
        Object.assign(new CategoryStatisticsDto(), {
          id: 1,
          name: 'Tech',
          slug: null,
          articleCount: 10,
          publishedCount: 8,
          privateCount: 2,
          totalViews: 1500,
        }),
      ];

      const dto = new OverallStatisticsDto();
      dto.totalCategories = 1;
      dto.totalTags = 0;
      dto.totalArticles = 10;
      dto.publishedArticles = 8;
      dto.privateArticles = 2;
      dto.hiddenArticles = 0;
      dto.totalViews = 1500;
      dto.categories = categories;
      dto.tags = [];

      expect(dto.categories[0].slug).toBeNull();
    });

    it('should handle tags with undefined slugs', () => {
      const tags: TagStatisticsDto[] = [
        Object.assign(new TagStatisticsDto(), {
          id: 1,
          name: 'TypeScript',
          articleCount: 25,
          totalViews: 3500,
        }),
      ];

      const dto = new OverallStatisticsDto();
      dto.totalCategories = 0;
      dto.totalTags = 1;
      dto.totalArticles = 25;
      dto.publishedArticles = 25;
      dto.privateArticles = 0;
      dto.hiddenArticles = 0;
      dto.totalViews = 3500;
      dto.categories = [];
      dto.tags = tags;

      expect(dto.tags[0].slug).toBeUndefined();
    });
  });
});
