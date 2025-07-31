export interface Analytics {
  id: number;
  type: AnalyticsType;
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  data?: string | null;
  createdAt: Date | null;
}

export enum AnalyticsType {
  PAGEVIEW = 'pageview',
  EVENT = 'event',
  API_CALL = 'api_call',
}

export interface AnalyticsData {
  [key: string]: unknown;
  articleId?: number;
  category?: string;
  tag?: string;
  duration?: number;
}
