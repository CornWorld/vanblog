import type PocketBase from 'pocketbase';
import type {
  TimelineEntry,
  SearchResult,
  TLSStatus,
  MigrationResult,
} from './types';

// Vanblog built-in services, same level as pb's collection(), files(), etc.
export interface VanblogServices {
  feed: {
    rss(): Promise<string>;
    atom(): Promise<string>;
    sitemap(): Promise<string>;
  };
  timeline: {
    list(): Promise<TimelineEntry[]>;
  };
  search: {
    query(q: string, opts?: { limit?: number }): Promise<SearchResult[]>;
  };
  tls: {
    status(): Promise<TLSStatus>;
  };
  migrate: {
    import(data: unknown): Promise<MigrationResult>;
  };
}

// A generic service namespace (for user-extended APIs)
export type ServiceNamespace = Record<string, (...args: any[]) => Promise<any>>;

// The full client type: PocketBase instance + vanblog services + extension namespaces
export type VanblogClient = PocketBase & {
  vanblog: VanblogServices;
} & Record<string, any>; // extension namespaces via client.extend()

// Factory: create vanblog services bound to a pb instance
export function createVanblogServices(pb: PocketBase): VanblogServices {
  return {
    feed: {
      rss: () => pb.send('/api/feed.xml', { method: 'GET' }) as Promise<string>,
      atom: () => pb.send('/api/atom.xml', { method: 'GET' }) as Promise<string>,
      sitemap: () => pb.send('/api/sitemap.xml', { method: 'GET' }) as Promise<string>,
    },
    timeline: {
      list: () => pb.send('/api/vanblog/timeline', { method: 'GET' }) as Promise<TimelineEntry[]>,
    },
    search: {
      query: (q: string, opts?: { limit?: number }) =>
        pb.send('/api/vanblog/search', {
          method: 'GET',
          params: { q, ...(opts?.limit ? { limit: opts.limit } : {}) },
        }) as Promise<SearchResult[]>,
    },
    tls: {
      status: () => pb.send('/api/vanblog/tls/status', { method: 'GET' }) as Promise<TLSStatus>,
    },
    migrate: {
      import: (data: unknown) =>
        pb.send('/api/vanblog/migrate/import', {
          method: 'POST',
          body: data,
        }) as Promise<MigrationResult>,
    },
  };
}
