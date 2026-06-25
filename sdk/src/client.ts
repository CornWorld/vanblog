import PocketBase from "pocketbase";
import { createVanblogServices } from "./services";
import type { VanblogClient, VanblogServices } from "./services";

export interface CreateClientOptions {
  /** PocketBase server URL. Server-side: http://127.0.0.1:8090. Client-side: /api (same-origin proxy). */
  url?: string;
}

/**
 * Create a Vanblog client — a PocketBase instance with vanblog service namespaces.
 *
 * The returned object is a standard PocketBase instance with all native methods
 * (collection, files, authStore, send, subscribe, etc.) plus a `.vanblog`
 * namespace for vanblog-specific APIs.
 *
 * @example
 * ```ts
 * const client = createVanblogClient({ url: 'http://127.0.0.1:8090' });
 *
 * // pb native
 * await client.collection('posts').getList(1, 10);
 *
 * // vanblog services
 * await client.vanblog.timeline.list();
 * await client.vanblog.search.query('golang');
 * ```
 */
export function createVanblogClient(
  opts: CreateClientOptions = {}
): VanblogClient {
  const url = opts.url ?? getDefaultURL();
  const pb = new PocketBase(url) as VanblogClient;

  // Attach vanblog service namespace (like pb.collection / pb.files)
  pb.vanblog = createVanblogServices(pb);

  // Attach extend() for user-defined services
  pb.extend = (
    name: string,
    service: Record<string, (...args: any[]) => Promise<any>>
  ) => {
    (pb as any)[name] = service;
    return pb;
  };

  return pb;
}

/**
 * Register a custom service namespace on the client.
 * For user-defined pb_hooks routes.
 *
 * @example
 * ```ts
 * client.extend('bookmarks', {
 *   list: () => client.send('/api/bookmarks/list'),
 *   add: (url: string) => client.send('/api/bookmarks/add', { method: 'POST', body: { url } }),
 * });
 *
 * await client.bookmarks.list();
 * ```
 */
declare module "pocketbase" {
  interface PocketBase {
    vanblog: VanblogServices;
    extend<T extends Record<string, (...args: any[]) => Promise<any>>>(
      name: string,
      service: T
    ): this & Record<string, T>;
  }
}

function getDefaultURL(): string {
  // Server-side: internal container address
  if (typeof window === "undefined") {
    // Node.js / SSR context
    const env = (globalThis as any).process?.env;
    return env?.PB_URL || "http://127.0.0.1:8090";
  }
  // Client-side: same-origin (Caddy proxies /api/* to pb)
  return "/api";
}
