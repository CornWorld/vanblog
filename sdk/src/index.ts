// @vanblog/sdk — PocketBase JS SDK with vanblog service namespaces

// Client factory (auto-detects server vs browser)
export { createVanblogClient } from "./client";
export type { CreateClientOptions } from "./client";

// Zod v4 runtime schemas, models registry, and all inferred business types.
export * from "./models";

// Vanblog custom types (Go routes + JSON field shapes)
export type { BackupFile, VanblogClient, VanblogServices } from "./services";
export type {
  TimelineEntry,
  SearchResult,
  TrashEntry,
  TLSStatus,
  MigrationResult,
} from "./types";

// Service factory (for advanced usage)
export { createVanblogServices } from "./services";

// Auth helpers
export {
  isAuthenticated,
  getAuthUser,
  hasPermission,
  requireAdmin,
  safe,
  createServerClient,
  exportAuthCookie,
  type AuthUser,
  type PluginNavItem,
  type VanblogMiddlewareOptions,
} from "./server";

// Middleware factory
export { createVanblogMiddleware } from "./server";

// Browser helpers
export { createBrowserClient, getClient, initClient, logout } from "./browser";

// Cookie constants
export { AUTH_COOKIE_OPTIONS } from "./cookie";

// Date utilities
export { parseDate, fmtDate, fmtDateTime, fmtRelativeTime } from "./dates";

// Content utilities
export { stripMarkdown } from "./services";

// General utilities
export { getPage, buildPageHref } from "./utils";
