import { z } from 'zod';
import { initContract } from '@ts-rest/core';
import { dateStr } from '../date-codecs.js';

export const AnalyticsRecordPayloadSchema = z.record(z.string(), z.any());
export type AnalyticsRecordPayload = z.infer<typeof AnalyticsRecordPayloadSchema>;

export const AnalyticsRecordBodySchema = z.object({
  type: z.string(),
  path: z.string().optional(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
  payload: AnalyticsRecordPayloadSchema.optional(),
  timestamp: dateStr.optional(),
});

export type AnalyticsRecordBody = z.infer<typeof AnalyticsRecordBodySchema>;

export const AnalyticsLogResponseSchema = z.object({
  id: z.number(),
  type: z.string(),
  content: z.string(),
  createdAt: dateStr,
});

export const createAnalyticsContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    // Public recording endpoints
    recordAnalytics: {
      method: 'POST',
      path: '/analytics/record',
      body: z.object({
        type: z.string(),
        path: z.string().optional().nullable(),
        referrer: z.string().optional().nullable(),
        userAgent: z.string().optional().nullable(),
        ip: z.string().optional().nullable(),
        data: z.any().optional(),
      }),
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
      responses: { 200: z.any() },
      summary: 'Get analytics overview',
    },
    pageRankings: {
      method: 'GET',
      path: '/v2/analytics/page-rankings',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get page rankings',
    },
    referrers: {
      method: 'GET',
      path: '/v2/analytics/referrers',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get referrer stats',
    },
    chart: {
      method: 'GET',
      path: '/v2/analytics/chart',
      query: z.object({ days: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get chart data',
    },
    devices: {
      method: 'GET',
      path: '/v2/analytics/devices',
      query: z.object({}).optional(),
      responses: { 200: z.any() },
      summary: 'Get device stats',
    },
    browsers: {
      method: 'GET',
      path: '/v2/analytics/browsers',
      query: z.object({}).optional(),
      responses: { 200: z.any() },
      summary: 'Get browser stats',
    },
    topArticles: {
      method: 'GET',
      path: '/v2/analytics/top-articles',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get top articles',
    },
    articleStats: {
      method: 'GET',
      path: '/v2/analytics/article/:id',
      pathParams: z.object({ id: z.string() }),
      query: z.object({}).optional(),
      responses: { 200: z.any() },
      summary: 'Get article stats',
    },
    export: {
      method: 'GET',
      path: '/v2/analytics/export',
      query: z.any(),
      responses: { 200: z.any() },
      summary: 'Export analytics data',
    },
    echartsDashboard: {
      method: 'GET',
      path: '/v2/analytics/echarts/dashboard',
      query: z.object({ days: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get Echarts dashboard data',
    },
    echartsTimeSeries: {
      method: 'GET',
      path: '/v2/analytics/echarts/timeseries',
      query: z.object({ days: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get Echarts time series data',
    },
    echartsDevices: {
      method: 'GET',
      path: '/v2/analytics/echarts/devices',
      query: z.object({}).optional(),
      responses: { 200: z.any() },
      summary: 'Get Echarts devices data',
    },
    echartsBrowsers: {
      method: 'GET',
      path: '/v2/analytics/echarts/browsers',
      query: z.object({}).optional(),
      responses: { 200: z.any() },
      summary: 'Get Echarts browsers data',
    },
    echartsPageRankings: {
      method: 'GET',
      path: '/v2/analytics/echarts/page-rankings',
      query: z.object({ limit: z.coerce.number().optional() }).optional(),
      responses: { 200: z.any() },
      summary: 'Get Echarts page rankings data',
    },
  });
