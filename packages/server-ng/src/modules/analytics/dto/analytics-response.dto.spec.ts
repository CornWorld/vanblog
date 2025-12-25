import { describe, it, expect } from 'vitest';
import {
  AnalyticsOverviewDto,
  PageRankingDto,
  ReferrerStatsDto,
  TimeSeriesDataDto,
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from './analytics-response.dto';

describe('AnalyticsOverviewDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new AnalyticsOverviewDto();
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
    const dto = new AnalyticsOverviewDto();
    dto.todayPageviews = 0;
    dto.yesterdayPageviews = 0;
    dto.totalPageviews = 0;
    dto.todayVisitors = 0;
    dto.yesterdayVisitors = 0;
    dto.totalVisitors = 0;

    expect(dto.todayPageviews).toBe(0);
    expect(dto.yesterdayPageviews).toBe(0);
    expect(dto.totalPageviews).toBe(0);
    expect(dto.todayVisitors).toBe(0);
    expect(dto.yesterdayVisitors).toBe(0);
    expect(dto.totalVisitors).toBe(0);
  });

  it('should handle large numbers', () => {
    const dto = new AnalyticsOverviewDto();
    dto.todayPageviews = 1000000;
    dto.yesterdayPageviews = 900000;
    dto.totalPageviews = 50000000;
    dto.todayVisitors = 500000;
    dto.yesterdayVisitors = 450000;
    dto.totalVisitors = 20000000;

    expect(dto.totalPageviews).toBe(50000000);
    expect(dto.totalVisitors).toBe(20000000);
  });
});

describe('PageRankingDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new PageRankingDto();
    dto.path = '/articles/123';
    dto.views = 500;
    dto.uniqueVisitors = 300;

    expect(dto.path).toBe('/articles/123');
    expect(dto.views).toBe(500);
    expect(dto.uniqueVisitors).toBe(300);
  });

  it('should handle root path', () => {
    const dto = new PageRankingDto();
    dto.path = '/';
    dto.views = 1000;
    dto.uniqueVisitors = 800;

    expect(dto.path).toBe('/');
  });

  it('should handle zero views', () => {
    const dto = new PageRankingDto();
    dto.path = '/page';
    dto.views = 0;
    dto.uniqueVisitors = 0;

    expect(dto.views).toBe(0);
    expect(dto.uniqueVisitors).toBe(0);
  });

  it('should handle unicode in path', () => {
    const dto = new PageRankingDto();
    dto.path = '/文章/标题';
    dto.views = 100;
    dto.uniqueVisitors = 50;

    expect(dto.path).toBe('/文章/标题');
  });
});

describe('ReferrerStatsDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new ReferrerStatsDto();
    dto.referrer = 'https://google.com';
    dto.count = 250;

    expect(dto.referrer).toBe('https://google.com');
    expect(dto.count).toBe(250);
  });

  it('should handle direct traffic', () => {
    const dto = new ReferrerStatsDto();
    dto.referrer = 'direct';
    dto.count = 100;

    expect(dto.referrer).toBe('direct');
  });

  it('should handle empty referrer', () => {
    const dto = new ReferrerStatsDto();
    dto.referrer = '';
    dto.count = 50;

    expect(dto.referrer).toBe('');
  });

  it('should handle social media referrers', () => {
    const dto = new ReferrerStatsDto();
    dto.referrer = 'https://twitter.com';
    dto.count = 75;

    expect(dto.referrer).toBe('https://twitter.com');
    expect(dto.count).toBe(75);
  });
});

describe('TimeSeriesDataDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new TimeSeriesDataDto();
    dto.time = '2024-01-01T00:00:00Z';
    dto.value = 100;

    expect(dto.time).toBe('2024-01-01T00:00:00Z');
    expect(dto.value).toBe(100);
  });

  it('should handle zero value', () => {
    const dto = new TimeSeriesDataDto();
    dto.time = '2024-01-01T00:00:00Z';
    dto.value = 0;

    expect(dto.value).toBe(0);
  });

  it('should handle various date formats', () => {
    const dto = new TimeSeriesDataDto();
    dto.time = '2024-01-01';
    dto.value = 50;

    expect(dto.time).toBe('2024-01-01');
  });

  it('should handle large values', () => {
    const dto = new TimeSeriesDataDto();
    dto.time = '2024-12-31';
    dto.value = 1000000;

    expect(dto.value).toBe(1000000);
  });
});

describe('AnalyticsChartDataDto', () => {
  it('should create instance with all required fields', () => {
    const pageviews = [
      Object.assign(new TimeSeriesDataDto(), { time: '2024-01-01', value: 100 }),
      Object.assign(new TimeSeriesDataDto(), { time: '2024-01-02', value: 150 }),
    ];

    const visitors = [
      Object.assign(new TimeSeriesDataDto(), { time: '2024-01-01', value: 50 }),
      Object.assign(new TimeSeriesDataDto(), { time: '2024-01-02', value: 75 }),
    ];

    const dto = new AnalyticsChartDataDto();
    dto.pageviews = pageviews;
    dto.visitors = visitors;

    expect(dto.pageviews).toHaveLength(2);
    expect(dto.visitors).toHaveLength(2);
    expect(dto.pageviews[0].value).toBe(100);
    expect(dto.visitors[0].value).toBe(50);
  });

  it('should handle empty arrays', () => {
    const dto = new AnalyticsChartDataDto();
    dto.pageviews = [];
    dto.visitors = [];

    expect(dto.pageviews).toEqual([]);
    expect(dto.visitors).toEqual([]);
  });

  it('should handle large datasets', () => {
    const pageviews = Array.from({ length: 365 }, (_, i) =>
      Object.assign(new TimeSeriesDataDto(), {
        time: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        value: Math.floor(Math.random() * 1000),
      }),
    );

    const dto = new AnalyticsChartDataDto();
    dto.pageviews = pageviews;
    dto.visitors = [];

    expect(dto.pageviews).toHaveLength(365);
  });
});

describe('DeviceStatsDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new DeviceStatsDto();
    dto.device = 'Desktop';
    dto.count = 500;
    dto.percentage = 62.5;

    expect(dto.device).toBe('Desktop');
    expect(dto.count).toBe(500);
    expect(dto.percentage).toBe(62.5);
  });

  it('should handle mobile devices', () => {
    const dto = new DeviceStatsDto();
    dto.device = 'Mobile';
    dto.count = 250;
    dto.percentage = 31.25;

    expect(dto.device).toBe('Mobile');
    expect(dto.percentage).toBe(31.25);
  });

  it('should handle tablet devices', () => {
    const dto = new DeviceStatsDto();
    dto.device = 'Tablet';
    dto.count = 50;
    dto.percentage = 6.25;

    expect(dto.device).toBe('Tablet');
    expect(dto.percentage).toBe(6.25);
  });

  it('should handle zero percentage', () => {
    const dto = new DeviceStatsDto();
    dto.device = 'Other';
    dto.count = 0;
    dto.percentage = 0;

    expect(dto.percentage).toBe(0);
  });

  it('should handle 100% percentage', () => {
    const dto = new DeviceStatsDto();
    dto.device = 'Desktop';
    dto.count = 1000;
    dto.percentage = 100;

    expect(dto.percentage).toBe(100);
  });
});

describe('BrowserStatsDto', () => {
  it('should create instance with all required fields', () => {
    const dto = new BrowserStatsDto();
    dto.browser = 'Chrome';
    dto.count = 600;
    dto.percentage = 75;

    expect(dto.browser).toBe('Chrome');
    expect(dto.count).toBe(600);
    expect(dto.percentage).toBe(75);
  });

  it('should handle Firefox browser', () => {
    const dto = new BrowserStatsDto();
    dto.browser = 'Firefox';
    dto.count = 100;
    dto.percentage = 12.5;

    expect(dto.browser).toBe('Firefox');
  });

  it('should handle Safari browser', () => {
    const dto = new BrowserStatsDto();
    dto.browser = 'Safari';
    dto.count = 80;
    dto.percentage = 10;

    expect(dto.browser).toBe('Safari');
  });

  it('should handle Edge browser', () => {
    const dto = new BrowserStatsDto();
    dto.browser = 'Edge';
    dto.count = 20;
    dto.percentage = 2.5;

    expect(dto.browser).toBe('Edge');
  });

  it('should handle zero values', () => {
    const dto = new BrowserStatsDto();
    dto.browser = 'Opera';
    dto.count = 0;
    dto.percentage = 0;

    expect(dto.count).toBe(0);
    expect(dto.percentage).toBe(0);
  });

  it('should handle unknown browsers', () => {
    const dto = new BrowserStatsDto();
    dto.browser = 'Unknown';
    dto.count = 5;
    dto.percentage = 0.6;

    expect(dto.browser).toBe('Unknown');
    expect(dto.percentage).toBe(0.6);
  });
});
