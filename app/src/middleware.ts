import { defineMiddleware } from "astro:middleware";
import { createVanblogClient } from "@vanblog/sdk";
import type { SiteConfig } from "@vanblog/sdk";

let cachedSite: Partial<SiteConfig> | null = null;
let siteFetchTime = 0;
const SITE_CACHE_TTL = 60_000; // 1 min

/**
 * Check if the current request is authenticated (any logged-in user).
 */
export function isAuthenticated(context: { locals: App.Locals }): boolean {
  return context.locals.pb.authStore.isValid;
}

export interface AuthUser {
  id: string;
  username: string;
  nickname?: string;
  role: "admin" | "collaborator";
  permissions: string[];
}

/**
 * Return the current logged-in user's role-relevant fields, or null.
 * Reads from the pb authStore record (populated after loadFromCookie).
 */
export function getAuthUser(context: {
  locals: App.Locals;
}): AuthUser | null {
  const pb = context.locals.pb;
  if (!pb.authStore.isValid) return null;
  const rec = pb.authStore.record as any;
  if (!rec) return null;
  return {
    id: rec.id,
    username: rec.username,
    nickname: rec.nickname,
    role: rec.role === "admin" ? "admin" : "collaborator",
    permissions: Array.isArray(rec.permissions) ? rec.permissions : [],
  };
}

/**
 * Check the current user has a specific permission.
 * admin role OR permissions containing "all" always passes.
 * `perm` is checked exactly OR via prefix "article:" style with `?=` semantics.
 */
export function hasPermission(
  context: { locals: App.Locals },
  perm: string
): boolean {
  const user = getAuthUser(context);
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.permissions.includes("all")) return true;
  if (user.permissions.includes(perm)) return true;
  // prefix match: e.g. perm="article:create" vs permission="article:*"
  // pb stores explicit values; we only do exact match here. Caller can
  // pass the granular perm.
  return false;
}

export function requireAdmin(context: {
  locals: App.Locals;
}): AuthUser | null {
  const user = getAuthUser(context);
  if (!user || user.role !== "admin") return null;
  return user;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const client = createVanblogClient({ url: "http://127.0.0.1:8090" });

  const cookie = context.request.headers.get("cookie") || "";
  if (cookie) {
    try {
      client.authStore.loadFromCookie(cookie);
    } catch {}
  }

  context.locals.pb = client;

  // Lazy site config — only fetched when a page actually calls getSite()
  context.locals.getSite = async () => {
    if (cachedSite && Date.now() - siteFetchTime < SITE_CACHE_TTL)
      return cachedSite;
    try {
      cachedSite = await client.vanblog.site.get();
      siteFetchTime = Date.now();
    } catch {}
    return cachedSite;
  };

  const response = await next();

  try {
    if (client.authStore.isValid)
      response.headers.append("set-cookie", client.authStore.exportToCookie());
  } catch {}

  return response;
});
