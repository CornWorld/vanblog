/** Vanblog custom Go API response types. */

// ── Go route response types ────────────────────────────────────────────

export interface TimelineEntry {
  year: number;
  count: number;
  months: {
    month: number;
    count: number;
    titles: {
      id: string;
      title: string;
      pathname: string;
      createdAt: string;
    }[];
  }[];
}

export interface SearchResult {
  id: string;
  title: string;
  path: string;
}

export interface TrashEntry {
  id: string;
  title: string;
  status: string;
  updated: string; // RFC3339
}

export interface TLSStatus {
  caddyReachable: boolean;
  allowedDomains: string[];
  allowAll: boolean;
  certificates: {
    domain: string;
    allowed: boolean;
  }[];
  httpsRedirect: boolean;
  onDemandTLS: boolean;
  managementPort: number;
}

export interface MigrationResult {
  /** Number of posts imported. */
  posts: number;
  /** Per-post import errors (non-fatal, import continues). */
  errors: string[];
}
