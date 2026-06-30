import type PocketBase from 'pocketbase';
import type {
  TimelineEntry,
  SearchResult,
  TLSStatus,
  MigrationResult,
  TrashEntry,
  SiteConfig,
} from './types';

// PocketBase js-sdk's send() parses non-JSON responses into objects.
// For feed/sitemap (XML) endpoints we use raw fetch to get the text.
async function fetchText(pb: PocketBase, path: string): Promise<string> {
  const res = await fetch(pb.buildUrl(path));
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.text();
}

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
  posts: {
    trash(): Promise<TrashEntry[]>;
    restore(id: string): Promise<void>;
  };
  site: {
    get(): Promise<SiteConfig | null>;
    update(id: string, patch: Partial<SiteConfig>): Promise<SiteConfig>;
  };
  media: {
    delete(id: string): Promise<void>;
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
      rss: () => fetchText(pb, '/api/feed.xml'),
      atom: () => fetchText(pb, '/api/atom.xml'),
      sitemap: () => fetchText(pb, '/api/sitemap.xml'),
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
    posts: {
      trash: () =>
        pb.send('/api/vanblog/posts/trash', { method: 'GET' }) as Promise<TrashEntry[]>,
      restore: (id: string) =>
        pb.send(`/api/vanblog/posts/${id}/restore`, {
          method: 'POST',
        }) as Promise<void>,
    },
    site: {
      get: async (): Promise<SiteConfig | null> => {
        const res = await pb.collection('site').getList<SiteConfig>(1, 1);
        return res.items[0] ?? null;
      },
      update: (id: string, patch: Partial<SiteConfig>) =>
        pb.collection('site').update<SiteConfig>(id, patch),
    },
    media: {
      delete: (id: string) =>
        pb.send(`/api/vanblog/media/${id}`, { method: 'DELETE' }) as Promise<void>,
    },
  };
}
