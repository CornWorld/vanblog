// Vanblog collection types — mirrors Go schema definitions

export interface Post {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'hidden';
  oldId?: number;
  tags: string[];
  category: string;
  author: string;
  pathname: string;
  top: number;
  private: boolean;
  password: string;
  copyright: string;
  viewCount: number;
  visitedCount: number;
  lastVisitedAt: string;
  deleted: boolean;
  created: string;
  updated: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string;
  oldName: string;
  created: string;
  updated: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'category' | 'column';
  private: boolean;
  password: string;
  meta: Record<string, unknown>;
  oldId: number;
  created: string;
  updated: string;
}

export interface Media {
  id: string;
  file: string;
  staticType: 'img' | 'favicon' | 'attachment';
  storageType: 'local' | 's3' | 'external';
  fileType: string;
  sign: string;
  meta: Record<string, unknown>;
  externalUrl: string;
  oldId: number;
  created: string;
  updated: string;
}

export interface Revision {
  id: string;
  target: string;
  snapshot: {
    title: string;
    content: string;
    status: string;
  };
  diff: string;
  authoredBy: string;
  reason: string;
  created: string;
  updated: string;
}

export interface Visit {
  id: string;
  date: string;
  path: string;
  views: number;
  uniques: number;
  post: string;
  lastVisitedAt: string;
  created: string;
  updated: string;
}

export interface SiteConfig {
  id: string;
  siteName: string;
  siteDesc: string;
  author: string;
  authDesc: string;
  authorLogo: string;
  authorLogoDark: string;
  siteLogo: string;
  siteLogoDark: string;
  favicon: string;
  gaAnalysisId: string;
  baiduAnalysisId: string;
  baseUrl: string;
  since: string;
  copyrightAggreement: string;
  beianNumber: string;
  beianUrl: string;
  gaBeianNumber: string;
  gaBeianUrl: string;
  gaBeianLogoUrl: string;
  payAliPay: string;
  payWechat: string;
  payAliPayDark: string;
  payWechatDark: string;
  theme: 'default' | 'minimal' | 'magazine' | 'custom';
  defaultTheme: 'auto' | 'light' | 'dark';
  commentsProvider: 'disabled' | 'waline' | 'giscus' | 'artalk' | 'external';
  commentsConfig: Record<string, unknown>;
  analyticsScript: string;
  aboutContent: string;
  aboutUpdatedAt: string;
  customHead: string;
  customCss: string;
  customHtml: string;
  customScript: string;
  enableWaterMark: boolean;
  /**
   * Client-side image normalization config. Read by ByteMdEditor via the
   * site record API; consumed by app/src/lib/media/normalizeImage.ts.
   *
   * - enabled=false OR targetFormat='preserve': uploads pass through
   *   unchanged. pb silently falls back to original for BMP/TIFF/SVG/AVIF.
   * - targetFormat='webp'/'avif': rasterize via createImageBitmap,
   *   re-encode via @jsquash. SVG bypasses regardless.
   * - quality: 1-100, applies to webp/avif encoding only.
   */
  mediaConfig?: {
    enabled: boolean;
    targetFormat: 'webp' | 'avif' | 'preserve';
    quality: number;
  };
  watermarkText: string;
  enableWebp: boolean;
  routing: RouteRule[];
  allowedDomains: string[];
  httpsRedirect: boolean;
  caddyLogLevel: string;
  revisionsEnabled: boolean;
  revisionsRetention: number;
  displayOptions: Record<string, unknown>;
  nav: NavItem[];
  links: LinkItem[];
  socials: SocialItem[];
  rewards: RewardItem[];
  outputEnabled: boolean;
  outputDest: string;
  outputConfig: Record<string, unknown>;
  syncEnabled: boolean;
  syncRemote: string;
  syncConfig: Record<string, unknown>;
  created: string;
  updated: string;
}

export interface NavItem {
  name: string;
  value: string;
  level: number;
}

export interface LinkItem {
  name: string;
  url: string;
  desc?: string;
  logo?: string;
}

export interface SocialItem {
  type: string;
  value: string;
}

export interface RewardItem {
  name: string;
  value: string;
}

export interface RouteRule {
  id: string;
  /**
   * - proxy: reverse_proxy to `to` (full URL)
   * - redirect: HTTP redirect to `to` (status `code`, default 301)
   * - rewrite: internal URI rewrite to `to` (absolute path)
   * - block: respond 403
   * - cache: stamp response `headers` (e.g. Cache-Control) on the matched
   *   path. Non-terminal — the reverse_proxy fallback in Caddyfile still
   *   serves the body, so this only adds cache semantics.
   */
  type: 'proxy' | 'redirect' | 'rewrite' | 'block' | 'cache';
  from: string;
  to: string;
  code?: number;
  headers?: Record<string, string>;
}

// Vanblog API response types

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
  posts: number;
  categories: number;
  tags: number;
  media: number;
  archive: boolean;
  errors: string[];
}
