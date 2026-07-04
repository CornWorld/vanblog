import { createVanblogClient } from './client';
import type { CreateClientOptions } from './client';
import type { VanblogClient } from './services';
import { AUTH_COOKIE_OPTIONS } from './cookie';

// ── Types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  nickname?: string;
  role: 'admin' | 'collaborator';
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
  opts: CreateClientOptions & { cookie?: string },
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
      client.authStore.clear();
    }
  }

  return client;
}

/** Export the auth cookie string for setting on response headers. */
export function exportAuthCookie(
  client: VanblogClient,
  secure: boolean,
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
    role: rec.role === 'admin' ? 'admin' : 'collaborator',
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
  if (user.role === 'admin') return true;
  if (user.permissions.includes('all')) return true;
  return user.permissions.includes(perm);
}

/** Return the auth user only if they are an admin, otherwise null. */
export function requireAdmin(pb: VanblogClient): AuthUser | null {
  const user = getAuthUser(pb);
  if (!user || user.role !== 'admin') return null;
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
  label: string,
): Promise<{ data: T | undefined; error: boolean }> {
  try {
    return { data: await fn(), error: false };
  } catch (e) {
    console.error(`[${label}]`, e);
    return { data: undefined, error: true };
  }
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
export function createVanblogMiddleware(opts: VanblogMiddlewareOptions = {}) {
  const pbUrl = opts.pbUrl || 'http://127.0.0.1:8090';

  // Lazy site config cache (lives for the process lifetime)
  let cachedSite: any = null;
  let siteFetchTime = 0;
  const SITE_CACHE_TTL = 60_000; // 1 min

  return async (context: any, next: () => Promise<Response>): Promise<Response> => {
    const client = createVanblogClient({ url: pbUrl });

    const cookie = context.request.headers.get('cookie') || '';
    if (cookie) {
      try {
        client.authStore.loadFromCookie(cookie);
      } catch {}
    }

    context.locals.pb = client;

    const url = new URL(context.request.url);

    // Refresh auth token server-side on every authenticated request.
    if (client.authStore.isValid) {
      try {
        await client.collection('users').authRefresh();
      } catch {
        client.authStore.clear();
      }
    }

    // Bootstrap mode: when no admin exists yet, push to /setup.
    if (
      !client.authStore.isValid &&
      (url.pathname.startsWith('/admin') || url.pathname === '/login')
    ) {
      try {
        const s = await client.vanblog.setup.status();
        if (s.bootstrap) {
          const back = encodeURIComponent(url.pathname + url.search);
          return context.redirect(`/setup?back=${back}`);
        }
      } catch {
        // setup status unreachable — fall through to normal auth.
      }
    }

    // All /admin/* routes require authentication.
    if (url.pathname.startsWith('/admin') && !client.authStore.isValid) {
      const back = encodeURIComponent(url.pathname + url.search);
      return context.redirect(`/login?back=${back}`);
    }

    // Lazy site config — only fetched when a page calls getSite().
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
    try {
      if (client.authStore.isValid) {
        response.headers.append(
          'set-cookie',
          client.authStore.exportToCookie({
            ...AUTH_COOKIE_OPTIONS,
            secure: url.protocol === 'https:',
          }),
        );
      }
    } catch {}

    return response;
  };
}
