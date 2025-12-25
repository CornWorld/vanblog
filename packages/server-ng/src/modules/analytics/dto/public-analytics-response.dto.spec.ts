import { describe, it, expect } from 'vitest';
import {
  PublicAnalyticsOverviewDto,
  PublicArticleStatsDto,
  PublicPageRankingDto,
} from './public-analytics-response.dto';

describe('PublicAnalyticsOverviewDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new PublicAnalyticsOverviewDto();
    dto.todayPageviews = 100;
    dto.yesterdayPageviews = 90;
    dto.totalPageviews = 5000;
    dto.todayVisitors = 50;
    dto.yesterdayVisitors = 45;
    dto.totalVisitors = 2000;

    expect(dto.todayPageviews).toBe(100);
    expect(dto.yesterdayPageviews).toBe(90);
    expect(dto.totalPageviews).toBe(5000);
    expect(dto.todayVisitors).toBe(50);
    expect(dto.yesterdayVisitors).toBe(45);
    expect(dto.totalVisitors).toBe(2000);
  });

  it('should handle zero values', () => {
    const dto = new PublicAnalyticsOverviewDto();
    dto.todayPageviews = 0;
    dto.yesterdayPageviews = 0;
    dto.totalPageviews = 0;
    dto.todayVisitors = 0;
    dto.yesterdayVisitors = 0;
    dto.totalVisitors = 0;

    expect(dto.todayPageviews).toBe(0);
    expect(dto.yesterdayPageviews).toBe(0);
    expect(dto.totalPageviews).toBe(0);
  });

  it('should handle large numbers', () => {
    const dto = new PublicAnalyticsOverviewDto();
    dto.todayPageviews = 1000000;
    dto.yesterdayPageviews = 900000;
    dto.totalPageviews = 50000000;
    dto.todayVisitors = 500000;
    dto.yesterdayVisitors = 450000;
    dto.totalVisitors = 20000000;

    expect(dto.totalPageviews).toBe(50000000);
    expect(dto.totalVisitors).toBe(20000000);
  });

  it('should handle visitor growth scenario', () => {
    const dto = new PublicAnalyticsOverviewDto();
    dto.todayPageviews = 150;
    dto.yesterdayPageviews = 100;
    dto.totalPageviews = 10000;
    dto.todayVisitors = 75;
    dto.yesterdayVisitors = 50;
    dto.totalVisitors = 5000;

    expect(dto.todayPageviews).toBeGreaterThan(dto.yesterdayPageviews);
    expect(dto.todayVisitors).toBeGreaterThan(dto.yesterdayVisitors);
  });

  it('should handle visitor decline scenario', () => {
    const dto = new PublicAnalyticsOverviewDto();
    dto.todayPageviews = 80;
    dto.yesterdayPageviews = 100;
    dto.totalPageviews = 10000;
    dto.todayVisitors = 40;
    dto.yesterdayVisitors = 50;
    dto.totalVisitors = 5000;

    expect(dto.todayPageviews).toBeLessThan(dto.yesterdayPageviews);
    expect(dto.todayVisitors).toBeLessThan(dto.yesterdayVisitors);
  });
});

describe('PublicArticleStatsDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 123;
    dto.title = 'Test Article';
    dto.views = 500;
    dto.uniqueVisitors = 300;
    dto.avgReadTime = 120;

    expect(dto.articleId).toBe(123);
    expect(dto.title).toBe('Test Article');
    expect(dto.views).toBe(500);
    expect(dto.uniqueVisitors).toBe(300);
    expect(dto.avgReadTime).toBe(120);
  });

  it('should handle zero views', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 1;
    dto.title = 'New Article';
    dto.views = 0;
    dto.uniqueVisitors = 0;
    dto.avgReadTime = 0;

    expect(dto.views).toBe(0);
    expect(dto.uniqueVisitors).toBe(0);
    expect(dto.avgReadTime).toBe(0);
  });

  it('should handle unicode in title', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 456;
    dto.title = '测试文章标题';
    dto.views = 100;
    dto.uniqueVisitors = 50;
    dto.avgReadTime = 90;

    expect(dto.title).toBe('测试文章标题');
  });

  it('should handle emoji in title', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 789;
    dto.title = '🚀 Amazing Article';
    dto.views = 200;
    dto.uniqueVisitors = 150;
    dto.avgReadTime = 180;

    expect(dto.title).toBe('🚀 Amazing Article');
  });

  it('should handle large view counts', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 1;
    dto.title = 'Viral Article';
    dto.views = 1000000;
    dto.uniqueVisitors = 800000;
    dto.avgReadTime = 300;

    expect(dto.views).toBe(1000000);
    expect(dto.uniqueVisitors).toBe(800000);
  });

  it('should handle short read time', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 2;
    dto.title = 'Quick Read';
    dto.views = 50;
    dto.uniqueVisitors = 40;
    dto.avgReadTime = 15;

    expect(dto.avgReadTime).toBe(15);
  });

  it('should handle long read time', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 3;
    dto.title = 'In-depth Guide';
    dto.views = 100;
    dto.uniqueVisitors = 80;
    dto.avgReadTime = 3600;

    expect(dto.avgReadTime).toBe(3600);
  });

  it('should handle decimal read times', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 4;
    dto.title = 'Article';
    dto.views = 75;
    dto.uniqueVisitors = 60;
    dto.avgReadTime = 125.5;

    expect(dto.avgReadTime).toBe(125.5);
  });

  it('should handle special characters in title', () => {
    const dto = new PublicArticleStatsDto();
    dto.articleId = 5;
    dto.title = 'Article & Guide: "Best Practices" (2024)';
    dto.views = 150;
    dto.uniqueVisitors = 100;
    dto.avgReadTime = 200;

    expect(dto.title).toBe('Article & Guide: "Best Practices" (2024)');
  });
});

describe('PublicPageRankingDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/articles/***';
    dto.views = 500;

    expect(dto.path).toBe('/articles/***');
    expect(dto.views).toBe(500);
  });

  it('should handle sanitized path', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/articles/***';
    dto.views = 1000;

    expect(dto.path).toBe('/articles/***');
  });

  it('should handle root path', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/';
    dto.views = 2000;

    expect(dto.path).toBe('/');
    expect(dto.views).toBe(2000);
  });

  it('should handle zero views', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/page/***';
    dto.views = 0;

    expect(dto.views).toBe(0);
  });

  it('should handle large view counts', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/popular/***';
    dto.views = 1000000;

    expect(dto.views).toBe(1000000);
  });

  it('should handle category paths', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/category/***';
    dto.views = 300;

    expect(dto.path).toBe('/category/***');
  });

  it('should handle tag paths', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/tag/***';
    dto.views = 150;

    expect(dto.path).toBe('/tag/***');
  });

  it('should handle about page', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/about';
    dto.views = 250;

    expect(dto.path).toBe('/about');
  });

  it('should handle sanitized unicode paths', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/文章/***';
    dto.views = 100;

    expect(dto.path).toBe('/文章/***');
  });

  it('should handle timeline page', () => {
    const dto = new PublicPageRankingDto();
    dto.path = '/timeline';
    dto.views = 200;

    expect(dto.path).toBe('/timeline');
  });
});
