import { contract } from '../contract.js';

export { contract };
export type { NavigationItem } from '../schemas.js';
export type Contract = typeof contract;

// Existing contracts
export { backupContract } from './backup.contract.js';
export { authContract } from './auth.contract.js';
export { commentContract } from './comment.contract.js';
export { sitemapContract } from './sitemap.contract.js';
export { pluginsContract } from './plugins.contract.js';
export { webhookContract } from './webhook.contract.js';
export { permissionContract } from './permission.contract.js';

// Newly migrated contracts
export { createUserContract } from './user.contract.js';
export { createMediaContract } from './media.contract.js';
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
export { createAnalyticsContract } from './analytics.contract.js';
export { createArticleContract } from './article.contract.js';
export {
  createCategoryContract,
  CategoryResponseSchema,
  ArticleResponseSchema,
} from './category.contract.js';
export { createTagContract, TagResponseSchema } from './tag.contract.js';
export { createDraftContract, DraftResponseSchema } from './draft.contract.js';
export {
  draftVersionContract,
  DraftVersionMetaSchema,
  DraftVersionContentSchema,
  DraftVersionResponseSchema,
  DraftVersionListResponseSchema,
} from './draft-version.contract.js';
export type {
  DraftVersionMeta,
  DraftVersionContent,
  DraftVersionResponse,
  DraftVersionListResponse,
} from './draft-version.contract.js';
export { timelineContract } from './timeline.contract.js';
export { TimelineArticleInputSchema } from '../timeline-schemas.js';
export type { TimelineArticleInput } from '../timeline-schemas.js';
