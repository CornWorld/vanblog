import { createVanblogClient, getDefaultVanblogURL } from "./client";
import type { CreateClientOptions } from "./client";
import type { VanblogClient } from "./services";
import { AUTH_COOKIE_OPTIONS } from "./cookie";

// ── Types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  nickname?: string;
  role: "admin" | "collaborator";
  permissions: string[];
}

interface PbUserRecord {
  id: string;
  username: string;
  nickname?: string;
  role: string;
  permissions?: string[];
}

// ── Client creation ─────────────────────────────────────────────────────

/**
 * Create a server-side client for SSR contexts.
 * Loads auth state from cookie, refreshes token if valid.
 */
export function createServerClient(
  opts: CreateClientOptions & { cookie?: string }
): VanblogClient {
  const client = createVanblogClient(opts);

  if (opts.cookie) {
    client.authStore.loadFromCookie(opts.cookie);

    try {
      if (client.authStore.isValid) {
        const collectionName = (client.authStore.record as any)?.collectionName;
        if (collectionName) {
          client.collection(collectionName).authRefresh();
        }
      }
    } catch {
      console.warn("[vanblog] failed to refresh auth token, clearing");
      client.authStore.clear();
    }
  }

  return client;
}

/** Export the auth cookie string for setting on response headers. */
export function exportAuthCookie(
  client: VanblogClient,
  secure: boolean
): string {
  return client.authStore.exportToCookie({
    ...AUTH_COOKIE_OPTIONS,
    secure,
  });
}

// ── Auth helpers ────────────────────────────────────────────────────────

/** Check if the given client is authenticated (any logged-in user). */
export function isAuthenticated(pb: VanblogClient): boolean {
  return pb.authStore.isValid;
}

/**
 * Return the current logged-in user's role-relevant fields, or null.
 * Reads from the pb authStore record (populated after loadFromCookie).
 */
export function getAuthUser(pb: VanblogClient): AuthUser | null {
  if (!pb.authStore.isValid) return null;
  const rec = pb.authStore.record as PbUserRecord | null;
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
 */
export function hasPermission(pb: VanblogClient, perm: string): boolean {
  const user = getAuthUser(pb);
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.permissions.includes("all")) return true;
  return user.permissions.includes(perm);
}

/** Return the auth user only if they are an admin, otherwise null. */
export function requireAdmin(pb: VanblogClient): AuthUser | null {
  const user = getAuthUser(pb);
  if (!user || user.role !== "admin") return null;
  return user;
}

// ── safe ────────────────────────────────────────────────────────────────

/**
 * Wraps any async function with try/catch + console.error logging.
 * Returns { data, error } instead of throwing, so callers can render
 * error states inline rather than crashing.
 *
 * @example
 * const { data: posts = [], error } = await safe(
 *   () => Astro.locals.pb.vanblog.posts.listPublished(1, 10),
 *   'index'
 * );
 */
export async function safe<T>(
  fn: () => Promise<T>,
  label: string
): Promise<{ data: T | undefined; error: boolean }> {
  try {
    return { data: await fn(), error: false };
  } catch (e) {
    console.error(`[${label}]`, e);
    return { data: undefined, error: true };
  }
}

// ── Nav item type ──────────────────────────────────────────────────────

export interface PluginNavItem {
  path: string;
  title: string;
  position: string;
}

// ── Middleware factory ──────────────────────────────────────────────────

/**
 * Options for createVanblogMiddleware.
 * Designed for Astro's defineMiddleware pattern.
 */
export interface VanblogMiddlewareOptions {
  /** PocketBase URL (default: http://127.0.0.1:8090) */
  pbUrl?: string;
}

/**
 * Factory that returns an Astro middleware handler.
 *
 * Encapsulates: client creation, cookie-based auth boot, bootstrap-mode
 * redirect, admin auth guard, site config lazy loader, and auth cookie
 * re-export on every response.
 *
 * Usage in src/middleware.ts:
 * ```ts
 * import { createVanblogMiddleware } from '@vanblog/sdk/server';
 * export const onRequest = createVanblogMiddleware();
 * ```
 */

const DOWN_ERROR_HTML = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>服务暂时不可用 — Vanblog</title>
<style>
  body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;color:#374151}
  .card{text-align:center;padding:2.5rem 2rem;max-width:28rem}
  h1{font-size:3rem;font-weight:800;margin:0 0 .5rem;color:#dc2626}
  p{font-size:1.125rem;margin:.5rem 0}
  .hint{font-size:.875rem;color:#6b7280;margin-top:1.5rem}
</style></head>
<body><div class="card">
  <h1>503</h1>
  <p>后端服务暂时不可用</p>
  <p class="hint">PocketBase 未响应，请检查后端是否正常运行后刷新页面。</p>
</div></body></html>`;

// Check whether an error message looks like a network/connection failure
// (PocketBase unreachable) vs a genuine code bug.
function isConnectionError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("econnrefused") ||
    m.includes("fetch failed") ||
    m.includes("network error") ||
    m.includes("aborted") ||
    m.includes("timeout") ||
    m.includes("enotfound") ||
    m.includes("epipe") ||
    m.includes("socket hang up")
  );
}

function pbUnreachable(): Response {
  return new Response(DOWN_ERROR_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function createVanblogMiddleware(opts: VanblogMiddlewareOptions = {}) {
  const pbUrl = opts.pbUrl ?? getDefaultVanblogURL();

  // Lazy site config cache (lives for the process lifetime)
  let cachedSite: any = null;
  let siteFetchTime = 0;
  const SITE_CACHE_TTL = 60_000; // 1 min

  return async (
    context: any,
    next: () => Promise<Response>
  ): Promise<Response> => {
    const url = new URL(context.request.url);
    const client = createVanblogClient({ url: pbUrl });

    const cookie = context.request.headers.get("cookie") || "";
    if (cookie) {
      try {
        client.authStore.loadFromCookie(cookie);
      } catch {
        console.warn("[vanblog] failed to load auth from cookie");
      }
    }

    context.locals.pb = client;
    context.locals.pbUrl = pbUrl;

    // Set up lazy loaders before anything that might throw, so pages can
    // always call them. Each loader swallows its own errors and returns
    // a safe default (null / empty array).
    context.locals.getSite = async () => {
      if (cachedSite && Date.now() - siteFetchTime < SITE_CACHE_TTL)
        return cachedSite;
      try {
        cachedSite = await client.vanblog.site.get();
        siteFetchTime = Date.now();
      } catch {
        console.warn("[vanblog] getSite failed, returning cached/default");
      }
      return cachedSite;
    };

    const navCache: PluginNavItem[] = [];
    context.locals.getNavItems = async () => navCache;

    // Auth refresh — if PocketBase is down this throws, which means the
    // token can't be validated. Return 503 rather than proceeding with
    // a stale/cleared session.
    if (client.authStore.isValid) {
      try {
        await client.collection("users").authRefresh();
      } catch {
        console.warn("[vanblog] auth refresh failed, clearing session");
        // If the failure is a genuine auth error (expired/invalid token),
        // clear the store and proceed as anonymous. If PocketBase is
        // unreachable, the bootstrap check below will catch it.
        try {
          client.authStore.clear();
        } catch {}
      }
    }

    // Bootstrap mode: when no admin exists yet, push to /setup.
    // This also serves as the PocketBase reachability check — if the
    // server is down, setup.status() will throw and we return 503.
    if (
      !client.authStore.isValid &&
      (url.pathname.startsWith("/admin") || url.pathname === "/login")
    ) {
      try {
        const s = await client.vanblog.setup.status();
        if (s.bootstrap) {
          const back = encodeURIComponent(url.pathname + url.search);
          return context.redirect(`/setup?back=${back}`);
        }
      } catch (err) {
        console.error("[vanblog] PocketBase unreachable at", pbUrl, err);
        return pbUnreachable();
      }
    }

    // All /admin/* routes require authentication.
    if (url.pathname.startsWith("/admin") && !client.authStore.isValid) {
      const back = encodeURIComponent(url.pathname + url.search);
      return context.redirect(`/login?back=${back}`);
    }

    // Catch connection errors during page rendering (PocketBase down mid-render)
    // and return 503. Non-network errors (coding bugs) are re-thrown so Astro's
    // own error handling can surface them rather than being masked as 503.
    let response: Response;
    try {
      response = await next();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (isConnectionError(msg)) {
        console.error("[vanblog] PocketBase unreachable during render:", msg);
        return pbUnreachable();
      }
      throw err;
    }

    // Re-export auth cookie on every response so the token stays fresh.
    try {
      if (client.authStore.isValid) {
        response.headers.append(
          "set-cookie",
          client.authStore.exportToCookie({
            ...AUTH_COOKIE_OPTIONS,
            secure: url.protocol === "https:",
          })
        );
      }
    } catch {
      console.warn("[vanblog] failed to export auth cookie");
    }
    return response;
  };
}
