// @vanblog/sdk — PocketBase JS SDK with vanblog service namespaces

// Client factory (auto-detects server vs browser)
export { createVanblogClient } from './client';
export type { CreateClientOptions } from './client';

// Types
export type { VanblogClient, VanblogServices } from './services';
export type {
  Post, Tag, Category, Media, Revision, Visit, SiteConfig,
  NavItem, LinkItem, SocialItem, RewardItem, RouteRule,
  TimelineEntry, SearchResult, TLSStatus, MigrationResult, TrashEntry,
} from './types';

// Service factory (for advanced usage)
export { createVanblogServices } from './services';

// Auth helpers
export {
  isAuthenticated,
  getAuthUser,
  hasPermission,
  requireAdmin,
  safeQuery,
  createServerClient,
  exportAuthCookie,
  type AuthUser,
  type VanblogMiddlewareOptions,
} from './server';

// Middleware factory
export { createVanblogMiddleware } from './server';

// Browser helpers
export { createBrowserClient, initBrowserPb, logout } from './browser';

// Cookie constants
export { AUTH_COOKIE_OPTIONS } from './cookie';

// Date utilities
export { parsePbDate, formatPbDate, formatPbDateOnly } from './dates';

// Content utilities
export { stripMarkdown } from './services';
