import { createVanblogClient } from './client';
import type { CreateClientOptions } from './client';
import type { VanblogClient } from './services';

/**
 * Create a browser-side client for client-side hydration.
 * Uses same-origin path (/) so requests go through Caddy.
 * Auth state is auto-managed by PocketBase SDK via localStorage.
 */
export function createBrowserClient(opts?: CreateClientOptions): VanblogClient {
  return createVanblogClient({
    url: '/', // Same-origin; PocketBase SDK internally appends /api/...
    ...opts,
  });
}

/**
 * Initialize the browser pb client from cookie and expose as window.__pb.
 * Call once per page (replaces the PbInit.astro component).
 *
 * @example
 * ```html
 * <script>
 *   import { initClient } from '@vanblog/sdk/browser';
 *   initClient();
 * </script>
 * ```
 */
export function initClient(): void {
  const pb = createBrowserClient();
  pb.authStore.loadFromCookie(document.cookie);
  (window as any).__pb = pb;
}

/**
 * Log out: clear cookie, localStorage, and auth store, then redirect.
 * Cookie is the single source of truth for the SSR middleware — clearing
 * it is all that's needed. We also wipe localStorage so any in-flight
 * client SDK calls don't reuse a stale token before the redirect lands.
 */
export function logout(redirectTo = '/'): void {
  document.cookie = 'pb_auth=; Path=/; Max-Age=0; SameSite=Lax';
  try { localStorage.removeItem('pocketbase_auth'); } catch (_) {}
  try { (window as any).__pb?.authStore.clear(); } catch (_) {}
  window.location.href = redirectTo;
}
