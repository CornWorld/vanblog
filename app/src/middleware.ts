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

/** PocketBase user record fields accessed by getAuthUser. */
interface PbUserRecord {
  id: string;
  username: string;
  nickname?: string;
  role: string;
  permissions?: string[];
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

  const url = new URL(context.request.url);

  // Refresh auth token server-side on every authenticated request. This is
  // the official PocketBase SSR pattern (loadFromCookie → authRefresh → next
  // → exportToCookie): it keeps the token alive before expiry and ensures
  // the cookie written back in the response always carries a fresh token.
  // Failure here means the token is invalid/expired — clear the store so
  // getAuthUser() returns null and the page can redirect to /login.
  if (client.authStore.isValid) {
    try {
      await client.collection("users").authRefresh();
    } catch {
      client.authStore.clear();
    }
  }

  // Bootstrap mode routing: when no admin exists yet, push the operator
  // to /setup instead of /login (which can't possibly work — there's no
  // account to log into). The check is best-effort: if the status call
  // fails we fall through to the normal auth flow rather than locking
  // the operator out.
  //
  // We only redirect unauthenticated traffic. An already-logged-in user
  // hitting /admin during bootstrap (e.g. after creating the first admin
  // but before their cookie refreshed) should not be bounced.
  if (!client.authStore.isValid && (url.pathname.startsWith("/admin") || url.pathname === "/login")) {
    try {
      const s = await client.vanblog.setup.status();
      if (s.bootstrap) {
        // Preserve the original destination as ?back= so /setup can
        // route there after success.
        const back = encodeURIComponent(url.pathname + url.search);
        return context.redirect(`/setup?back=${back}`);
      }
    } catch {
      // setup status unreachable — fall through to normal auth.
    }
  }

  // All /admin/* routes require authentication — enforced here so
  // individual pages don't need to repeat the check.
  if (url.pathname.startsWith("/admin") && !client.authStore.isValid) {
    const back = encodeURIComponent(url.pathname + url.search);
    return context.redirect(`/login?back=${back}`);
  }

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

  // Re-export auth cookie on every response so the token stays fresh.
  // Critical: must override PocketBase SDK defaults (secure=true, sameSite=strict,
  // httpOnly=true) — those defaults are silently dropped by browsers when the
  // site is served over plain HTTP (e.g. the dev container or any non-TLS
  // deploy). Symptoms of breakage: cookie never sets after login, or appears
  // "stuck" because the browser keeps using the last cookie it managed to
  // accept. Match PbInit.astro's client-side options.
  try {
    if (client.authStore.isValid) {
      response.headers.append(
        "set-cookie",
        client.authStore.exportToCookie({
          secure: url.protocol === "https:",
          sameSite: "lax",
          httpOnly: false,
        })
      );
    }
  } catch {}

  return response;
});
