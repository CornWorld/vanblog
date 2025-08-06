import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { EchartsFormatterService } from './echarts-formatter.service';

import type {
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from '../dto/analytics-response.dto';

describe('EchartsFormatterService', () => {
  let service: EchartsFormatterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EchartsFormatterService],
    }).compile();

    service = module.get<EchartsFormatterService>(EchartsFormatterService);
  });

  describe('formatTimeSeriesChart', () => {
    it('should format time series data for echarts', () => {
      const data: AnalyticsChartDataDto = {
        pageviews: [
          { time: '2024-01-01', value: 100 },
          { time: '2024-01-02', value: 150 },
        ],
        visitors: [
          { time: '2024-01-01', value: 50 },
          { time: '2024-01-02', value: 75 },
        ],
      };

      const result = service.formatTimeSeriesChart(data);

      expect(result.title?.text).toBe('访问趋势');
      expect(result.xAxis).toHaveProperty('data');
      expect(result.series).toHaveLength(2);
      expect(result.series[0]).toMatchObject({
        name: '页面访问量',
        type: 'line',
        smooth: true,
        data: [100, 150],
      });
      expect(result.series[1]).toMatchObject({
        name: '独立访客',
        type: 'line',
        smooth: true,
        data: [50, 75],
      });
    });
  });

  describe('formatDevicePieChart', () => {
    it('should format device stats for pie chart', () => {
      const data: DeviceStatsDto[] = [
        { device: 'Desktop', count: 100, percentage: 50 },
        { device: 'Mobile', count: 80, percentage: 40 },
        { device: 'Tablet', count: 20, percentage: 10 },
      ];

      const result = service.formatDevicePieChart(data);

      expect(result.title?.text).toBe('设备类型分布');
      expect(result.series).toHaveLength(1);
      expect(result.series[0]).toMatchObject({
        name: '设备类型',
        type: 'pie',
        radius: '50%',
      });

      const pieData = result.series[0] as { data: Array<{ name: string; value: number }> };
      expect(pieData.data).toHaveLength(3);
      expect(pieData.data[0]).toMatchObject({ name: 'Desktop', value: 100 });
    });
  });

  describe('formatBrowserBarChart', () => {
    it('should format browser stats for horizontal bar chart', () => {
      const data: BrowserStatsDto[] = [
        { browser: 'Chrome', count: 200, percentage: 60 },
        { browser: 'Firefox', count: 100, percentage: 30 },
        { browser: 'Safari', count: 33, percentage: 10 },
      ];

      const result = service.formatBrowserBarChart(data);

      expect(result.title?.text).toBe('浏览器统计');
      expect(result.xAxis).toMatchObject({ type: 'value' });
      expect(result.yAxis).toMatchObject({
        type: 'category',
        data: ['Chrome', 'Firefox', 'Safari'],
      });
      expect(result.series[0]).toMatchObject({
        name: '访问次数',
        type: 'bar',
        data: [200, 100, 33],
      });
    });
  });

  describe('formatPageRankingsChart', () => {
    it('should format page rankings for bar chart', () => {
      const data = [
        { path: '/home', views: 500 },
        { path: '/blog', views: 300 },
        { path: '/about', views: 100 },
      ];

      const result = service.formatPageRankingsChart(data);

      expect(result.title?.text).toBe('热门页面');
      expect(result.xAxis).toMatchObject({
        type: 'category',
        data: ['/home', '/blog', '/about'],
      });
      expect(result.series[0]).toMatchObject({
        name: '访问量',
        type: 'bar',
        data: [500, 300, 100],
      });
    });
  });

  describe('formatDashboard', () => {
    it('should create a dashboard with multiple charts', () => {
      const timeSeries: AnalyticsChartDataDto = {
        pageviews: [{ time: '2024-01-01', value: 100 }],
        visitors: [{ time: '2024-01-01', value: 50 }],
      };
      const devices: DeviceStatsDto[] = [{ device: 'Desktop', count: 100, percentage: 100 }];
      const browsers: BrowserStatsDto[] = [{ browser: 'Chrome', count: 100, percentage: 100 }];

      const result = service.formatDashboard(timeSeries, devices, browsers);

      expect(result).toHaveProperty('timeSeries');
      expect(result).toHaveProperty('devices');
      expect(result).toHaveProperty('browsers');
      expect(result.timeSeries.title?.text).toBe('访问趋势');
      expect(result.devices.title?.text).toBe('设备类型分布');
      expect(result.browsers.title?.text).toBe('浏览器统计');
    });
  });
});
