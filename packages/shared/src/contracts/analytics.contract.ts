import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { Analytics, PaginationQuery } from '../runtime/schema.js';

// Analytics overview response
export const AnalyticsOverview = z.object({
  totalViews: z.number(),
  totalVisitors: z.number(),
  totalArticles: z.number(),
  avgViewsPerArticle: z.number(),
});

// Page ranking item
export const PageRanking = z.object({
  path: z.string(),
  views: z.number(),
  visitors: z.number(),
});

// Referrer stats
export const ReferrerStats = z.object({
  referrer: z.string(),
  count: z.number(),
});

// Chart data point
export const ChartDataPoint = z.object({
  date: z.string(),
  views: z.number(),
  visitors: z.number(),
});

// Device/Browser stats
export const DeviceStats = z.object({
  name: z.string(),
  count: z.number(),
  percentage: z.number(),
});

// Top article stats
export const TopArticle = z.object({
  id: z.number(),
  title: z.string(),
  views: z.number(),
  visitors: z.number(),
});

// Article stats response
export const ArticleStats = z.object({
  totalViews: z.number(),
  uniqueVisitors: z.number(),
  avgReadingTime: z.number().optional(),
  dailyViews: z.array(ChartDataPoint),
});

// Analytics record body
export const AnalyticsRecordBody = z.object({
  type: z.string(),
  path: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  userAgent: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
  data: z.unknown().optional(),
});

export const createAnalyticsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    // Public recording endpoints
    recordAnalytics: {
      method: 'POST',
      path: '/analytics/record',
      body: AnalyticsRecordBody,
      responses: { 201: z.undefined() },
      summary: 'Record analytics data',
    },
    recordArticleView: {
      method: 'POST',
      path: '/analytics/article/:id/view',
      pathParams: z.object({ id: z.string() }),
      body: z.object({}),
      responses: { 201: z.undefined() },
      summary: 'Record article view',
    },
    recordReadingTime: {
      method: 'POST',
      path: '/analytics/article/:id/reading-time',
      pathParams: z.object({ id: z.string() }),
      body: z.object({ duration: z.number() }),
      responses: { 201: z.undefined() },
      summary: 'Record reading time',
    },
    // Admin analytics endpoints
    overview: {
      method: 'GET',
      path: '/v2/analytics/overview',
      query: z.object({}).optional(),
      responses: { 200: AnalyticsOverview },
      summary: 'Get analytics overview',
    },
    pageRankings: {
      method: 'GET',
      path: '/v2/analytics/page-rankings',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.array(PageRanking) },
      summary: 'Get page rankings',
    },
    referrers: {
      method: 'GET',
      path: '/v2/analytics/referrers',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.array(ReferrerStats) },
      summary: 'Get referrer stats',
    },
    chart: {
      method: 'GET',
      path: '/v2/analytics/chart',
      query: z.object({ days: z.coerce.number().optional() }).optional(),
      responses: { 200: z.array(ChartDataPoint) },
      summary: 'Get chart data',
    },
    devices: {
      method: 'GET',
      path: '/v2/analytics/devices',
      query: z.object({}).optional(),
      responses: { 200: z.array(DeviceStats) },
      summary: 'Get device stats',
    },
    browsers: {
      method: 'GET',
      path: '/v2/analytics/browsers',
      query: z.object({}).optional(),
      responses: { 200: z.array(DeviceStats) },
      summary: 'Get browser stats',
    },
    topArticles: {
      method: 'GET',
      path: '/v2/analytics/top-articles',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.array(TopArticle) },
      summary: 'Get top articles',
    },
    articleStats: {
      method: 'GET',
      path: '/v2/analytics/article/:id',
      pathParams: z.object({ id: z.string() }),
      query: z.object({}).optional(),
      responses: { 200: ArticleStats },
      summary: 'Get article stats',
    },
    export: {
      method: 'GET',
      path: '/v2/analytics/export',
      query: PaginationQuery.extend({
        type: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      responses: { 200: z.array(Analytics) },
      summary: 'Export analytics data',
    },
    echartsDashboard: {
      method: 'GET',
      path: '/v2/analytics/echarts/dashboard',
      query: z.object({ days: z.coerce.number().optional() }).optional(),
      responses: { 200: z.record(z.string(), z.unknown()) },
      summary: 'Get Echarts dashboard data',
    },
    echartsTimeSeries: {
      method: 'GET',
      path: '/v2/analytics/echarts/timeseries',
      query: z.object({ days: z.coerce.number().optional() }).optional(),
      responses: { 200: z.record(z.string(), z.unknown()) },
      summary: 'Get Echarts time series data',
    },
    echartsDevices: {
      method: 'GET',
      path: '/v2/analytics/echarts/devices',
      query: z.object({}).optional(),
      responses: { 200: z.record(z.string(), z.unknown()) },
      summary: 'Get Echarts devices data',
    },
    echartsBrowsers: {
      method: 'GET',
      path: '/v2/analytics/echarts/browsers',
      query: z.object({}).optional(),
      responses: { 200: z.record(z.string(), z.unknown()) },
      summary: 'Get Echarts browsers data',
    },
    echartsPageRankings: {
      method: 'GET',
      path: '/v2/analytics/echarts/page-rankings',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.record(z.string(), z.unknown()) },
      summary: 'Get Echarts page rankings data',
    },
  });
