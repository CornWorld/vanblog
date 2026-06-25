// @vanblog/sdk — PocketBase JS SDK with vanblog service namespaces

// Client factory (auto-detects server vs browser)
export { createVanblogClient } from './client';
export type { CreateClientOptions } from './client';

// Types
export type { VanblogClient, VanblogServices } from './services';
export type {
  Post, Tag, Category, Media, Revision, Visit, SiteConfig,
  NavItem, LinkItem, SocialItem, RewardItem, RouteRule,
  TimelineEntry, SearchResult, TLSStatus, MigrationResult,
} from './types';

// Service factory (for advanced usage)
export { createVanblogServices } from './services';
