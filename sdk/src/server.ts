import { createVanblogClient } from './client';
import type { CreateClientOptions } from './client';
import type { VanblogClient } from './services';

/**
 * Create a server-side client for SSR contexts.
 * Loads auth state from cookie, refreshes token if valid.
 *
 * @example
 * ```ts
 * // Astro middleware
 * import { createServerClient } from '@vanblog/sdk/server';
 *
 * export const onRequest = defineMiddleware(async (context, next) => {
 *   const client = createServerClient({
 *     url: 'http://127.0.0.1:8090',
 *     cookie: context.request.headers.get('cookie') || '',
 *   });
 *   context.locals.pb = client;
 *   const response = await next();
 *   response.headers.append('set-cookie', client.authStore.exportToCookie());
 *   return response;
 * });
 * ```
 */
export function createServerClient(
  opts: CreateClientOptions & { cookie?: string },
): VanblogClient {
  const client = createVanblogClient(opts);

  // Load auth state from cookie
  if (opts.cookie) {
    client.authStore.loadFromCookie(opts.cookie);

    // Validate and refresh token
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
export function exportAuthCookie(client: VanblogClient): string {
  return client.authStore.exportToCookie();
}
