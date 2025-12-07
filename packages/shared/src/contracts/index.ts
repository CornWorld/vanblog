import { contract } from '../contract.js';

export { contract };
export type Contract = typeof contract;

// Existing contracts
export { backupContract } from './backup.contract.js';
export { authContract } from './auth.contract.js';
export { commentContract } from './comment.contract.js';
export { sitemapContract } from './sitemap.contract.js';
export { pluginsContract, PluginInfo } from './plugins.contract.js';
export {
  webhookContract,
  WebhookList,
  WebhookLogList,
  WebhookStats,
  WebhookEvents,
  WebhookTriggerResponse,
} from './webhook.contract.js';
export { permissionContract } from './permission.contract.js';

// Newly migrated contracts
export { createUserContract, Collaborator } from './user.contract.js';
export {
  createMediaContract,
  StaticFileList,
  MediaQuery,
  BatchDeleteSchema,
  InitiateChunkUploadSchema,
  UploadChunkSchema,
  CompleteChunkUploadSchema,
  StorageConfig,
  UploadResponse,
  QueueStats,
  TaskStatus,
} from './media.contract.js';
export { createSettingContract } from './setting.contract.js';
export { createSettingRegistryContract } from './setting-registry.contract.js';
export { createOptionsContract } from './options.contract.js';
export { createPublicMetaContract } from './public-meta.contract.js';
export { createPublicBootstrapContract } from './public-bootstrap.contract.js';
export { createPublicCustomPageContract } from './public-custom-page.contract.js';
export { createPublicInitContract } from './public-init.contract.js';
export { createMetricsContract } from './metrics.contract.js';
export { createAdminCompatibilityContract } from './admin-compatibility.contract.js';
export { createPublicAnalyticsContract } from './public-analytics.contract.js';
export {
  createAnalyticsContract,
  AnalyticsOverview,
  PageRanking,
  ReferrerStats,
  ChartDataPoint,
  DeviceStats,
  TopArticle,
  ArticleStats,
  AnalyticsRecordBody,
} from './analytics.contract.js';
export { createArticleContract } from './article.contract.js';
export {
  createCategoryContract,
  CategoryWithCount,
  CategoryListResponse,
} from './category.contract.js';
export {
  createTagContract,
  TagWithCount,
  TagListResponse,
  TagStatistics,
  TagWithCategories,
} from './tag.contract.js';
export { createDraftContract, DraftQuery } from './draft.contract.js';
export { draftVersionContract, DraftVersionList } from './draft-version.contract.js';
export { createLoginLogContract } from './login-log.contract.js';
export { timelineContract } from './timeline.contract.js';
export { rssContract, createRssContract, RssItemSchema } from './rss.contract.js';
export { createMetaContract, MetaResponse, VersionInfo } from './meta.contract.js';
