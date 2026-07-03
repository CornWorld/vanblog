import type PocketBase from 'pocketbase';
import type {
  TimelineEntry,
  SearchResult,
  TLSStatus,
  MigrationResult,
  TrashEntry,
  SiteConfig,
  RouteRule,
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
  // setup is the first-run bootstrap flow. status() reports whether any
  // admin exists yet; complete() claims the first admin slot. Refuses
  // once the system has at least one admin.
  setup: {
    status(): Promise<{ bootstrap: boolean }>;
    complete(req: {
      username: string;
      email: string;
      password: string;
      passwordConfirm: string;
    }): Promise<{ ok: boolean; adminId?: string; error?: string }>;
  };
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
    purge(id: string): Promise<void>;
  };
  site: {
    get(): Promise<SiteConfig | null>;
    update(id: string, patch: Partial<SiteConfig>): Promise<SiteConfig>;
  };
  media: {
    delete(id: string): Promise<void>;
  };
  categories: {
    delete(id: string): Promise<void>;
  };
  tags: {
    delete(id: string): Promise<void>;
  };
  users: {
    delete(id: string): Promise<void>;
  };
  routing: {
    list(): Promise<{ rules: RouteRule[]; allowlist: string[] }>;
    // status returns the routing subsystem health: caddyLastError from site
    // table, caddy reachability, and the count of rules pending in the DB.
    // The admin UI uses this for the top-of-page health banner.
    status(): Promise<{
      caddyLastError?: string;
      caddy_reachable: boolean;
      pending_rules: number;
    }>;
    // audits returns the most recent routing-related audit entries — used
    // for the "what changed lately" panel at the top of /admin/routing.
    // Entries cover replace / rollback events with before/after rule IDs.
    audits(): Promise<{
      items: Array<{
        created: string;
        action: string;
        result: 'success' | 'failure';
        detail?: Record<string, unknown>;
        actorName?: string;
      }>;
    }>;
    // render returns the diagnostic view of what vanblog would push to
    // Caddy right now. userRoutes = TranslateAll output of just the
    // user's rules (small, focused); fullConfig = complete caddyadmin
    // Config (vanblog internals + user rules + TLS, what Caddy receives).
    // Read-only — operator/dev uses this to inspect the actual translation.
    render(): Promise<{
      userRoutes: Record<string, unknown>[];
      fullConfig?: Record<string, unknown>;
      error?: string;
    }>;
    // replace writes the rule set to site.routing and immediately pushes to
    // running Caddy. On push failure, the DB is rolled back to its
    // pre-replace value and the response carries ok=false + rolled_back=true
    // + a non-empty error string.
    replace(rules: RouteRule[], allowlist: string[]): Promise<{
      ok: boolean;
      applied: boolean;
      restart_needed: boolean;
      rolled_back?: boolean;
      error?: string;
    }>;
    validate(rule: RouteRule, allowlist?: string[]): Promise<{ ok: boolean; error?: string }>;
    apply(): Promise<{ applied: boolean; restart_needed: boolean; error?: string }>;
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
    setup: {
      status: () =>
        pb.send('/api/vanblog/setup/status', { method: 'GET' }) as Promise<{ bootstrap: boolean }>,
      complete: (req) =>
        pb.send('/api/vanblog/setup/complete', { method: 'POST', body: req }) as Promise<{
          ok: boolean;
          adminId?: string;
          error?: string;
        }>,
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
      purge: (id: string) =>
        pb.send(`/api/vanblog/posts/${id}/purge`, {
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
    categories: {
      delete: (id: string) =>
        pb.send(`/api/vanblog/categories/${id}`, { method: 'DELETE' }) as Promise<void>,
    },
    tags: {
      delete: (id: string) =>
        pb.send(`/api/vanblog/tags/${id}`, { method: 'DELETE' }) as Promise<void>,
    },
    users: {
      delete: (id: string) =>
        pb.send(`/api/vanblog/users/${id}`, { method: 'DELETE' }) as Promise<void>,
    },
    routing: {
      list: () =>
        pb.send('/api/vanblog/routing/rules', { method: 'GET' }) as Promise<{
          rules: RouteRule[];
          allowlist: string[];
        }>,
      status: () =>
        pb.send('/api/vanblog/routing/status', { method: 'GET' }) as Promise<{
          caddyLastError?: string;
          caddy_reachable: boolean;
          pending_rules: number;
        }>,
      audits: () =>
        pb.send('/api/vanblog/routing/audits', { method: 'GET' }) as Promise<{
          items: Array<{
            created: string;
            action: string;
            result: 'success' | 'failure';
            detail?: Record<string, unknown>;
            actorName?: string;
          }>;
        }>,
      render: () =>
        pb.send('/api/vanblog/routing/render', { method: 'GET' }) as Promise<{
          userRoutes: Record<string, unknown>[];
          fullConfig?: Record<string, unknown>;
          error?: string;
        }>,
      replace: (rules, allowlist) =>
        pb.send('/api/vanblog/routing/rules', {
          method: 'PUT',
          body: { rules, allowlist },
        }) as Promise<{
          ok: boolean;
          applied: boolean;
          restart_needed: boolean;
          rolled_back?: boolean;
          error?: string;
        }>,
      validate: (rule, allowlist = []) =>
        pb.send('/api/vanblog/routing/validate', {
          method: 'POST',
          body: { rule, allowlist },
        }) as Promise<{ ok: boolean; error?: string }>,
      apply: () =>
        pb.send('/api/vanblog/routing/apply', {
          method: 'POST',
        }) as Promise<{ applied: boolean; restart_needed: boolean; error?: string }>,
    },
  };
}
