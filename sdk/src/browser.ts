import { createVanblogClient } from './client';
import type { CreateClientOptions } from './client';
import type { VanblogClient } from './services';

/**
 * Create a browser-side client for client-side hydration.
 * Uses same-origin path (/api) so requests go through Caddy.
 * Auth state is auto-managed by PocketBase SDK via localStorage.
 *
 * @example
 * ```ts
 * import { createBrowserClient } from '@vanblog/sdk/browser';
 *
 * const pb = createBrowserClient();
 * await pb.collection('posts').create({ title: 'New Post' });
 * ```
 */
export function createBrowserClient(opts?: CreateClientOptions): VanblogClient {
  return createVanblogClient({
    url: '/api', // Same-origin, Caddy proxies to pb
    ...opts,
  });
}
