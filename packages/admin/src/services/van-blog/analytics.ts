import { client } from '../client';

export const analyticsService = {
  getAnalyticsOverview: client.getAnalyticsOverview,
  getAnalyticsLogs: client.getAnalyticsLogs,
  getPublicViewer: client.getPublicViewer,
  getArticleViewer: client.getArticleViewer,
  recordPublicViewer: client.recordPublicViewer,
};
