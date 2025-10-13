/**
 * Data Contracts for VanBlog Website
 *
 * This file defines strict TypeScript interfaces and default value strategies
 * to eliminate defensive programming patterns and "as any" type assertions.
 *
 * Philosophy: "Good taste eliminates special cases"
 */

import dayjs from 'dayjs';

// ============================================================================
// Core Site Information Contract
// ============================================================================

export interface SiteInfoContract {
  readonly author: string;
  readonly authorDesc: string;
  readonly authorLogo: string;
  readonly authorLogoDark: string;
  readonly siteLogo: string;
  readonly siteLogoDark: string;
  readonly favicon: string;
  readonly siteName: string;
  readonly siteDesc: string;
  readonly beianNumber: string;
  readonly beianUrl: string;
  readonly gaBeianNumber: string;
  readonly gaBeianUrl: string;
  readonly gaBeianLogoUrl: string;
  readonly payAliPay: string;
  readonly payWechat: string;
  readonly payAliPayDark: string;
  readonly payWechatDark: string;
  readonly since: string;
  readonly baseUrl: string;
  readonly baiduAnalysisId: string;
  readonly gaAnalysisId: string;
  readonly copyrightAggreement: string;
  readonly showSubMenu: boolean;
  readonly showAdminButton: boolean;
  readonly headerLeftContent: 'siteLogo' | 'siteName';
  readonly subMenuOffset: number;
  readonly showDonateInfo: boolean;
  readonly showFriends: boolean;
  readonly enableComment: boolean;
  readonly defaultTheme: 'auto' | 'light' | 'dark';
  readonly showDonateInAbout: boolean;
  readonly enableCustomizing: boolean;
  readonly showDonateButton: boolean;
  readonly showCopyRight: boolean;
  readonly showRSS: boolean;
  readonly openArticleLinksInNewWindow: boolean;
  readonly showExpirationReminder: boolean;
  readonly showEditButton: boolean;
}

// ============================================================================
// Default Value Factory - The "Good Taste" Approach
// ============================================================================

export const createDefaultSiteInfo = (): SiteInfoContract => ({
  author: '',
  authorDesc: '',
  authorLogo: '',
  authorLogoDark: '',
  siteLogo: '',
  siteLogoDark: '',
  favicon: '/logo.svg',
  siteName: 'VanBlog',
  siteDesc: '',
  beianNumber: '',
  beianUrl: '',
  gaBeianNumber: '',
  gaBeianUrl: '',
  gaBeianLogoUrl: '',
  payAliPay: '',
  payWechat: '',
  payAliPayDark: '',
  payWechatDark: '',
  since: dayjs().format('YYYY'),
  baseUrl: '',
  baiduAnalysisId: '',
  gaAnalysisId: '',
  copyrightAggreement: 'BY-NC-SA',
  showSubMenu: false,
  showAdminButton: true,
  headerLeftContent: 'siteName',
  subMenuOffset: 0,
  showDonateInfo: false,
  showFriends: false,
  enableComment: false,
  defaultTheme: 'auto',
  showDonateInAbout: false,
  enableCustomizing: false,
  showDonateButton: false,
  showCopyRight: false,
  showRSS: false,
  openArticleLinksInNewWindow: false,
  showExpirationReminder: false,
  showEditButton: false,
});

// ============================================================================
// Meta Data Contract
// ============================================================================

export interface SocialItemContract {
  readonly updatedAt: string;
  readonly type: 'bilibili' | 'email' | 'github' | 'wechat' | 'gitee' | 'wechat-dark';
  readonly value: string;
  readonly dark: string;
}

export interface LinkItemContract {
  readonly name: string;
  readonly desc: string;
  readonly logo: string;
  readonly url: string;
  readonly updatedAt: string;
}

export interface DonateItemContract {
  readonly name: string;
  readonly value: string;
  readonly updatedAt: string;
}

export interface AboutContract {
  readonly updatedAt: string;
  readonly content: string;
}

export interface MetaContract {
  readonly links: readonly LinkItemContract[];
  readonly socials: readonly SocialItemContract[];
  readonly rewards: readonly DonateItemContract[];
  readonly categories: readonly string[];
  readonly about: AboutContract;
  readonly siteInfo: SiteInfoContract;
}

export const createDefaultMeta = (): MetaContract => ({
  links: [],
  socials: [],
  rewards: [],
  categories: [],
  about: {
    updatedAt: dayjs().toISOString(),
    content: '',
  },
  siteInfo: createDefaultSiteInfo(),
});

// ============================================================================
// Menu Contract
// ============================================================================

export interface MenuItemContract {
  readonly id: number;
  readonly name: string;
  readonly value: string;
  readonly level: number;
  readonly children: readonly MenuItemContract[];
}

export const createDefaultMenu = (): readonly MenuItemContract[] => [
  { id: 0, name: '首页', value: '/', level: 0, children: [] },
  { id: 1, name: '标签', value: '/tag', level: 0, children: [] },
  { id: 2, name: '分类', value: '/category', level: 0, children: [] },
  { id: 3, name: '时间线', value: '/timeline', level: 0, children: [] },
  { id: 4, name: '友链', value: '/link', level: 0, children: [] },
  { id: 5, name: '关于', value: '/about', level: 0, children: [] },
];

// ============================================================================
// Layout Contract
// ============================================================================

export interface HeadTagContract {
  readonly name: string;
  readonly props: Readonly<Record<string, string>>;
  readonly content: string;
}

export interface LayoutContract {
  readonly css: string;
  readonly script: string;
  readonly html: string;
  readonly head: readonly HeadTagContract[];
}

export const createDefaultLayout = (): LayoutContract => ({
  css: '',
  script: '',
  html: '',
  head: [],
});

// ============================================================================
// Waline Contract
// ============================================================================

export interface WalineConfigContract {
  readonly serverURL: string;
}

export const createDefaultWalineConfig = (): WalineConfigContract => ({
  serverURL: '',
});

// ============================================================================
// Public Meta Contract - The Root Data Structure
// ============================================================================

export interface PublicMetaContract {
  readonly version: string;
  readonly tags: readonly string[];
  readonly totalArticles: number;
  readonly totalWordCount: number;
  readonly meta: MetaContract;
  readonly menus: readonly MenuItemContract[];
  readonly layout: LayoutContract;
  readonly walineConfig: WalineConfigContract;
}

export const createDefaultPublicMeta = (): PublicMetaContract => ({
  version: '1.0.0',
  tags: [],
  totalArticles: 0,
  totalWordCount: 0,
  meta: createDefaultMeta(),
  menus: createDefaultMenu(),
  layout: createDefaultLayout(),
  walineConfig: createDefaultWalineConfig(),
});

// ============================================================================
// Type Guards - Runtime Type Safety
// ============================================================================

export const isSiteInfoContract = (obj: unknown): obj is SiteInfoContract => {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return typeof candidate.siteName === 'string' && typeof candidate.defaultTheme === 'string';
};

export const isMetaContract = (obj: unknown): obj is MetaContract => {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return Array.isArray(candidate.categories) && isSiteInfoContract(candidate.siteInfo);
};

export const isPublicMetaContract = (obj: unknown): obj is PublicMetaContract => {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.tags) &&
    isMetaContract(candidate.meta)
  );
};

// ============================================================================
// Data Normalization Functions - "Never Break Userspace"
// ============================================================================

/**
 * Normalize raw API response to PublicMetaContract
 * This function eliminates all special cases and defensive programming
 */
export const normalizePublicMeta = (raw: unknown): PublicMetaContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultPublicMeta();
  }

  const data = raw as Record<string, unknown>;
  const defaultMeta = createDefaultPublicMeta();

  return {
    version: typeof data.version === 'string' ? data.version : defaultMeta.version,
    tags: Array.isArray(data.tags) ? [...data.tags] : defaultMeta.tags,
    totalArticles:
      typeof data.totalArticles === 'number' ? data.totalArticles : defaultMeta.totalArticles,
    totalWordCount:
      typeof data.totalWordCount === 'number' ? data.totalWordCount : defaultMeta.totalWordCount,
    meta: normalizeMeta(data.meta),
    menus: normalizeMenus(data.menus),
    layout: normalizeLayout(data.layout),
    walineConfig: normalizeWalineConfig(data.walineConfig),
  };
};

const normalizeMeta = (raw: unknown): MetaContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultMeta();
  }

  const data = raw as Record<string, unknown>;
  const defaultMeta = createDefaultMeta();

  return {
    links: Array.isArray(data.links) ? data.links.map(normalizeLink) : defaultMeta.links,
    socials: Array.isArray(data.socials) ? data.socials.map(normalizeSocial) : defaultMeta.socials,
    rewards: Array.isArray(data.rewards) ? data.rewards.map(normalizeDonate) : defaultMeta.rewards,
    categories: Array.isArray(data.categories) ? [...data.categories] : defaultMeta.categories,
    about: normalizeAbout(data.about),
    siteInfo: normalizeSiteInfo(data.siteInfo),
  };
};

const normalizeSiteInfo = (raw: unknown): SiteInfoContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultSiteInfo();
  }

  const data = raw as Record<string, unknown>;
  const defaultSiteInfo = createDefaultSiteInfo();

  return {
    author: typeof data.author === 'string' ? data.author : defaultSiteInfo.author,
    authorDesc: typeof data.authorDesc === 'string' ? data.authorDesc : defaultSiteInfo.authorDesc,
    authorLogo: typeof data.authorLogo === 'string' ? data.authorLogo : defaultSiteInfo.authorLogo,
    authorLogoDark:
      typeof data.authorLogoDark === 'string'
        ? data.authorLogoDark
        : defaultSiteInfo.authorLogoDark,
    siteLogo: typeof data.siteLogo === 'string' ? data.siteLogo : defaultSiteInfo.siteLogo,
    siteLogoDark:
      typeof data.siteLogoDark === 'string' ? data.siteLogoDark : defaultSiteInfo.siteLogoDark,
    favicon: typeof data.favicon === 'string' ? data.favicon : defaultSiteInfo.favicon,
    siteName: typeof data.siteName === 'string' ? data.siteName : defaultSiteInfo.siteName,
    siteDesc: typeof data.siteDesc === 'string' ? data.siteDesc : defaultSiteInfo.siteDesc,
    beianNumber:
      typeof data.beianNumber === 'string' ? data.beianNumber : defaultSiteInfo.beianNumber,
    beianUrl: typeof data.beianUrl === 'string' ? data.beianUrl : defaultSiteInfo.beianUrl,
    gaBeianNumber:
      typeof data.gaBeianNumber === 'string' ? data.gaBeianNumber : defaultSiteInfo.gaBeianNumber,
    gaBeianUrl: typeof data.gaBeianUrl === 'string' ? data.gaBeianUrl : defaultSiteInfo.gaBeianUrl,
    gaBeianLogoUrl:
      typeof data.gaBeianLogoUrl === 'string'
        ? data.gaBeianLogoUrl
        : defaultSiteInfo.gaBeianLogoUrl,
    payAliPay: typeof data.payAliPay === 'string' ? data.payAliPay : defaultSiteInfo.payAliPay,
    payWechat: typeof data.payWechat === 'string' ? data.payWechat : defaultSiteInfo.payWechat,
    payAliPayDark:
      typeof data.payAliPayDark === 'string' ? data.payAliPayDark : defaultSiteInfo.payAliPayDark,
    payWechatDark:
      typeof data.payWechatDark === 'string' ? data.payWechatDark : defaultSiteInfo.payWechatDark,
    since: typeof data.since === 'string' ? data.since : defaultSiteInfo.since,
    baseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : defaultSiteInfo.baseUrl,
    baiduAnalysisId:
      typeof data.baiduAnalysisId === 'string'
        ? data.baiduAnalysisId
        : defaultSiteInfo.baiduAnalysisId,
    gaAnalysisId:
      typeof data.gaAnalysisId === 'string' ? data.gaAnalysisId : defaultSiteInfo.gaAnalysisId,
    copyrightAggreement:
      typeof data.copyrightAggreement === 'string'
        ? data.copyrightAggreement
        : defaultSiteInfo.copyrightAggreement,
    showSubMenu: data.showSubMenu === 'true' || data.showSubMenu === true,
    showAdminButton: data.showAdminButton !== 'false' && data.showAdminButton !== false,
    headerLeftContent: data.headerLeftContent === 'siteLogo' ? 'siteLogo' : 'siteName',
    subMenuOffset:
      typeof data.subMenuOffset === 'number' ? data.subMenuOffset : defaultSiteInfo.subMenuOffset,
    showDonateInfo: data.showDonateInfo === 'true' || data.showDonateInfo === true,
    showFriends: data.showFriends === 'true' || data.showFriends === true,
    enableComment: data.enableComment === 'true' || data.enableComment === true,
    defaultTheme: (['auto', 'light', 'dark'] as const).includes(
      data.defaultTheme as 'auto' | 'light' | 'dark',
    )
      ? (data.defaultTheme as 'auto' | 'light' | 'dark')
      : 'auto',
    showDonateInAbout: data.showDonateInAbout === 'true' || data.showDonateInAbout === true,
    enableCustomizing: data.enableCustomizing === 'true' || data.enableCustomizing === true,
    showDonateButton: data.showDonateButton === 'true' || data.showDonateButton === true,
    showCopyRight: data.showCopyRight === 'true' || data.showCopyRight === true,
    showRSS: data.showRSS === 'true' || data.showRSS === true,
    openArticleLinksInNewWindow:
      data.openArticleLinksInNewWindow === 'true' || data.openArticleLinksInNewWindow === true,
    showExpirationReminder:
      data.showExpirationReminder === 'true' || data.showExpirationReminder === true,
    showEditButton: data.showEditButton === 'true' || data.showEditButton === true,
  };
};

const normalizeAbout = (raw: unknown): AboutContract => {
  if (!raw || typeof raw !== 'object') {
    return { updatedAt: dayjs().toISOString(), content: '' };
  }

  const data = raw as Record<string, unknown>;
  return {
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : dayjs().toISOString(),
    content: typeof data.content === 'string' ? data.content : '',
  };
};

const normalizeLink = (raw: unknown): LinkItemContract => {
  if (!raw || typeof raw !== 'object') {
    return { name: '', desc: '', logo: '', url: '', updatedAt: dayjs().toISOString() };
  }

  const data = raw as Record<string, unknown>;
  return {
    name: typeof data.name === 'string' ? data.name : '',
    desc: typeof data.desc === 'string' ? data.desc : '',
    logo: typeof data.logo === 'string' ? data.logo : '',
    url: typeof data.url === 'string' ? data.url : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : dayjs().toISOString(),
  };
};

const normalizeSocial = (raw: unknown): SocialItemContract => {
  if (!raw || typeof raw !== 'object') {
    return { updatedAt: dayjs().toISOString(), type: 'github', value: '', dark: '' };
  }

  const data = raw as Record<string, unknown>;
  const validTypes = ['bilibili', 'email', 'github', 'wechat', 'gitee', 'wechat-dark'] as const;

  return {
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : dayjs().toISOString(),
    type: validTypes.includes(data.type as (typeof validTypes)[number])
      ? (data.type as (typeof validTypes)[number])
      : 'github',
    value: typeof data.value === 'string' ? data.value : '',
    dark: typeof data.dark === 'string' ? data.dark : '',
  };
};

const normalizeDonate = (raw: unknown): DonateItemContract => {
  if (!raw || typeof raw !== 'object') {
    return { name: '', value: '', updatedAt: dayjs().toISOString() };
  }

  const data = raw as Record<string, unknown>;
  return {
    name: typeof data.name === 'string' ? data.name : '',
    value: typeof data.value === 'string' ? data.value : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : dayjs().toISOString(),
  };
};

const normalizeMenus = (raw: unknown): readonly MenuItemContract[] => {
  if (!Array.isArray(raw)) {
    return createDefaultMenu();
  }

  return raw.map(normalizeMenuItem);
};

const normalizeMenuItem = (raw: unknown): MenuItemContract => {
  if (!raw || typeof raw !== 'object') {
    return { id: 0, name: '', value: '', level: 0, children: [] };
  }

  const data = raw as Record<string, unknown>;
  return {
    id: typeof data.id === 'number' ? data.id : 0,
    name: typeof data.name === 'string' ? data.name : '',
    value: typeof data.value === 'string' ? data.value : '',
    level: typeof data.level === 'number' ? data.level : 0,
    children: Array.isArray(data.children) ? data.children.map(normalizeMenuItem) : [],
  };
};

const normalizeLayout = (raw: unknown): LayoutContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultLayout();
  }

  const data = raw as Record<string, unknown>;
  return {
    css: typeof data.css === 'string' ? data.css : '',
    script: typeof data.script === 'string' ? data.script : '',
    html: typeof data.html === 'string' ? data.html : '',
    head: Array.isArray(data.head) ? data.head.map(normalizeHeadTag) : [],
  };
};

const normalizeHeadTag = (raw: unknown): HeadTagContract => {
  if (!raw || typeof raw !== 'object') {
    return { name: '', props: {}, content: '' };
  }

  const data = raw as Record<string, unknown>;
  return {
    name: typeof data.name === 'string' ? data.name : '',
    props:
      typeof data.props === 'object' && data.props !== null
        ? { ...(data.props as Record<string, string>) }
        : {},
    content: typeof data.content === 'string' ? data.content : '',
  };
};

const normalizeWalineConfig = (raw: unknown): WalineConfigContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultWalineConfig();
  }

  const data = raw as Record<string, unknown>;
  return {
    serverURL: typeof data.serverURL === 'string' ? data.serverURL : '',
  };
};

// ============================================================================
// Analytics and Page View Contracts
// ============================================================================

export interface PageViewDataContract {
  readonly viewer: number;
  readonly visited: number;
}

export const createDefaultPageViewData = (): PageViewDataContract => ({
  viewer: 0,
  visited: 0,
});

export interface AnalyticsOverviewContract {
  readonly totalPageviews: number;
  readonly totalVisitors: number;
}

export const createDefaultAnalyticsOverview = (): AnalyticsOverviewContract => ({
  totalPageviews: 0,
  totalVisitors: 0,
});

export interface ArticleStatsContract {
  readonly views: number;
  readonly uniqueVisitors: number;
}

export const createDefaultArticleStats = (): ArticleStatsContract => ({
  views: 0,
  uniqueVisitors: 0,
});

// ============================================================================
// Normalization Functions for Analytics
// ============================================================================

export const normalizePageViewData = (raw: unknown): PageViewDataContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultPageViewData();
  }

  const data = raw as Record<string, unknown>;
  return {
    viewer: typeof data.viewer === 'number' ? data.viewer : 0,
    visited: typeof data.visited === 'number' ? data.visited : 0,
  };
};

export const normalizeAnalyticsOverview = (raw: unknown): AnalyticsOverviewContract => {
  if (!raw || typeof raw !== 'object') {
    return createDefaultAnalyticsOverview();
  }

  const data = raw as Record<string, unknown>;
  return {
    totalPageviews: typeof data.totalPageviews === 'number' ? data.totalPageviews : 0,
    totalVisitors: typeof data.totalVisitors === 'number' ? data.totalVisitors : 0,
  };
};

export const normalizeArticleStats = (raw: unknown): ArticleStatsContract => {
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    return {
      views: typeof obj.views === 'number' ? obj.views : 0,
      uniqueVisitors: typeof obj.uniqueVisitors === 'number' ? obj.uniqueVisitors : 0,
    };
  }
  return createDefaultArticleStats();
};

// ============================================================================
// Article Data Contract
// ============================================================================

export interface ArticleContract {
  readonly id: number;
  readonly title: string;
  readonly content: string;
  readonly pathname: string;
  readonly tags: readonly string[];
  readonly category: string;
  readonly author: string;
  readonly top: number;
  readonly hidden: boolean;
  readonly private: boolean;
  readonly password: string;
  readonly viewer: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly wordCount: number;
  readonly summary: string;
  readonly copyright: string;
}

export const createDefaultArticle = (): ArticleContract => ({
  id: 0,
  title: '',
  content: '',
  pathname: '',
  tags: [],
  category: '',
  author: '',
  top: 0,
  hidden: false,
  private: false,
  password: '',
  viewer: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  wordCount: 0,
  summary: '',
  copyright: '',
});

export const normalizeArticle = (raw: unknown): ArticleContract => {
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const defaultArticle = createDefaultArticle();

    return {
      id: typeof obj.id === 'number' ? obj.id : defaultArticle.id,
      title: typeof obj.title === 'string' ? obj.title : defaultArticle.title,
      content: typeof obj.content === 'string' ? obj.content : defaultArticle.content,
      pathname:
        typeof obj.pathname === 'string'
          ? obj.pathname
          : typeof obj.id === 'number'
            ? `/post/${obj.id}`
            : defaultArticle.pathname,
      tags: Array.isArray(obj.tags)
        ? obj.tags.filter((tag): tag is string => typeof tag === 'string')
        : defaultArticle.tags,
      category: typeof obj.category === 'string' ? obj.category : defaultArticle.category,
      author: typeof obj.author === 'string' ? obj.author : defaultArticle.author,
      top: typeof obj.top === 'number' ? obj.top : defaultArticle.top,
      hidden:
        typeof obj.hidden === 'boolean'
          ? obj.hidden
          : typeof obj.hide === 'boolean'
            ? obj.hide
            : defaultArticle.hidden,
      private:
        typeof obj.private === 'boolean'
          ? obj.private
          : typeof obj.secret === 'boolean'
            ? obj.secret
            : defaultArticle.private,
      password: typeof obj.password === 'string' ? obj.password : defaultArticle.password,
      viewer: typeof obj.viewer === 'number' ? obj.viewer : defaultArticle.viewer,
      createdAt:
        typeof obj.createdAt === 'string'
          ? obj.createdAt
          : typeof obj.date === 'string'
            ? obj.date
            : defaultArticle.createdAt,
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : defaultArticle.updatedAt,
      wordCount: typeof obj.wordCount === 'number' ? obj.wordCount : defaultArticle.wordCount,
      summary: typeof obj.summary === 'string' ? obj.summary : defaultArticle.summary,
      copyright: typeof obj.copyright === 'string' ? obj.copyright : defaultArticle.copyright,
    };
  }
  return createDefaultArticle();
};

export const normalizeArticles = (raw: unknown): readonly ArticleContract[] => {
  if (Array.isArray(raw)) {
    return raw.map(normalizeArticle);
  }
  return [];
};

// ============================================================================
// Payment Data Contract
// ============================================================================

export interface PaymentContract {
  readonly aliPay: string;
  readonly weChatPay: string;
  readonly aliPayDark: string;
  readonly weChatPayDark: string;
}

export const createDefaultPayment = (): PaymentContract => ({
  aliPay: '',
  weChatPay: '',
  aliPayDark: '',
  weChatPayDark: '',
});

export const normalizePayment = (pay: unknown, payDark: unknown): PaymentContract => {
  const defaultPayment = createDefaultPayment();

  const payArray = Array.isArray(pay) ? pay : [];
  const payDarkArray = Array.isArray(payDark) ? payDark : [];

  return {
    aliPay: typeof payArray[0] === 'string' ? payArray[0] : defaultPayment.aliPay,
    weChatPay: typeof payArray[1] === 'string' ? payArray[1] : defaultPayment.weChatPay,
    aliPayDark: typeof payDarkArray[0] === 'string' ? payDarkArray[0] : defaultPayment.aliPayDark,
    weChatPayDark:
      typeof payDarkArray[1] === 'string' ? payDarkArray[1] : defaultPayment.weChatPayDark,
  };
};

// ============================================================================
// Navigation Data Contract
// ============================================================================

export interface NavigationItemContract {
  readonly id: number;
  readonly title: string;
  readonly pathname: string;
}

export const createDefaultNavigationItem = (): NavigationItemContract => ({
  id: 0,
  title: '',
  pathname: '',
});

export const normalizeNavigationItem = (raw: unknown): NavigationItemContract => {
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const defaultItem = createDefaultNavigationItem();

    return {
      id: typeof obj.id === 'number' ? obj.id : defaultItem.id,
      title: typeof obj.title === 'string' ? obj.title : defaultItem.title,
      pathname:
        typeof obj.pathname === 'string'
          ? obj.pathname
          : typeof obj.id === 'number'
            ? `/post/${obj.id}`
            : defaultItem.pathname,
    };
  }
  return createDefaultNavigationItem();
};
