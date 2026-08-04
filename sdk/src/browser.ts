import { createVanblogClient } from "./client";
import type { CreateClientOptions } from "./client";
import type { VanblogClient } from "./services";

declare global {
  interface Window {
    vanblog?: { pb: VanblogClient };
  }
}

// ── Internal singleton ────────────────────────────────────────────────────

let _client: VanblogClient | null = null;

/**
 * Get the browser-side pb client. Must be called after initClient().
 * This is the canonical API for bundled `<script>` blocks.
 */
export function getClient(): VanblogClient {
  if (!_client)
    throw new Error("@vanblog/sdk/browser: initClient() must be called first");
  return _client;
}

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a browser-side client for client-side hydration.
 * Uses same-origin path (/) so requests go through Caddy.
 * Auth state is auto-managed by PocketBase SDK via localStorage.
 */
export function createBrowserClient(opts?: CreateClientOptions): VanblogClient {
  return createVanblogClient({
    url: "/", // Same-origin; PocketBase SDK internally appends /api/...
    ...opts,
  });
}

// ── Init ───────────────────────────────────────────────────────────────────

/**
 * Initialize the browser pb client from cookie.
 * Stores the client internally (accessible via getClient()) and exposes it as
 * `self.vanblog.pb` for `<script is:inline>` blocks that cannot use imports.
 *
 * @example
 * ```html
 * <script>
 *   import { initClient } from '@vanblog/sdk/browser';
 *   initClient();
 * </script>
 * ```
 *
 * For is:inline scripts:
 * ```html
 * <script is:inline>
 *   const pb = self.vanblog.pb;
 * </script>
 * ```
 */
export function initClient(): void {
  const pb = createBrowserClient();
  pb.authStore.loadFromCookie(document.cookie);
  _client = pb;
  window.vanblog = { pb };
}

// ── Logout ─────────────────────────────────────────────────────────────────

/**
 * Log out: clear cookie, localStorage, and auth store, then redirect.
 * Cookie is the single source of truth for the SSR middleware — clearing
 * it is all that's needed. We also wipe localStorage so any in-flight
 * client SDK calls don't reuse a stale token before the redirect lands.
 */
export function logout(redirectTo = "/"): void {
  // Prevent open redirect: only allow relative paths or same-origin URLs
  try {
    const safe = new URL(redirectTo, window.location.origin);
    if (safe.origin !== window.location.origin) {
      redirectTo = "/";
    }
  } catch {
    redirectTo = "/";
  }
  document.cookie = "pb_auth=; Path=/; Max-Age=0; SameSite=Lax";
  try {
    localStorage.removeItem("pocketbase_auth");
  } catch (_) {}
  try {
    _client?.authStore.clear();
  } catch (_) {}
  window.location.href = redirectTo;
}

// Theme & palette persistence helpers (see ./theme).
export * from "./theme";
