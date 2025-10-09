import { Article } from './article';
import { HeadTag } from '../utils/getLayoutProps';

export interface SortOrder {
  field: string;
  order: 'asc' | 'desc';
}

export interface GetArticleOption {
  page?: number;
  pageSize?: number;
  sort?: SortOrder;
}

export interface SocialItem {
  updatedAt: string;
  type: 'bilibili' | 'email' | 'github' | 'wechat' | 'gitee' | 'wechat-dark';
  value: string;
  dark?: string;
}

export interface MenuItem {
  id: number;
  name: string;
  value: string;
  level: number;
  children?: MenuItem[];
}

export interface DonateItem {
  name: string;
  value: string;
  updatedAt: string;
}

export interface LinkItem {
  name: string;
  desc: string;
  logo: string;
  url: string;
  updatedAt: string;
}

export interface SiteInfo {
  author: string;
  authorDesc: string;
  authorLogo: string;
  authorLogoDark?: string;
  siteLogo: string;
  favicon: string;
  siteName: string;
  siteDesc: string;
  beianNumber: string;
  beianUrl: string;
  gaBeianNumber: string;
  gaBeianUrl: string;
  gaBeianLogoUrl: string;
  payAliPay: string;
  payWechat: string;
  payAliPayDark?: string;
  payWechatDark?: string;
  since: string;
  baseUrl: string;
  baiduAnalysisId?: string;
  gaAnalysisId?: string;
  siteLogoDark?: string;
  copyrightAggreement: string;
  showSubMenu?: 'true' | 'false';
  showAdminButton?: 'true' | 'false';
  headerLeftContent?: 'siteLogo' | 'siteName';
  subMenuOffset?: number;
  showDonateInfo: 'true' | 'false';
  showFriends: 'true' | 'false';
  enableComment: 'true' | 'false';
  defaultTheme: 'auto' | 'light' | 'dark';
  showDonateInAbout?: 'true' | 'false';
  enableCustomizing: 'true' | 'false';
  showDonateButton: 'true' | 'false';
  showCopyRight: 'true' | 'false';
  showRSS: 'true' | 'false';
  openArticleLinksInNewWindow: 'true' | 'false';
  showExpirationReminder: 'true' | 'false';
  showEditButton: 'true' | 'false';
}

export interface MetaProps {
  links: LinkItem[];
  socials: SocialItem[];
  rewards: DonateItem[];
  categories: string[];
  about: {
    updatedAt: string;
    content: string;
  };
  siteInfo: SiteInfo;
}

export interface PublicMetaProp {
  version: string;
  tags: string[];
  totalArticles: number;
  meta: MetaProps;
  menus: MenuItem[];
  totalWordCount: number;
  layout?: {
    css?: string;
    script?: string;
    html?: string;
    head?: HeadTag[];
  };
}

export interface CustomPageList {
  name: string;
  path: string;
}

export interface CustomPage extends CustomPageList {
  html: string;
}

// Server-ng v2 API 统一响应格式
export interface ApiV2Response<T = unknown> {
  statusCode: number;
  data: T;
  message?: string;
  error?: string;
  meta?: {
    timestamp: string;
    path: string;
    version: string;
  };
}

// 分页数据格式
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 兼容旧格式的文章响应
export interface ArticleResponse {
  data: Article[];
  total: number;
  page: number;
  pageSize: number;
}

// 新的v2格式文章响应
export type ArticleV2Response = ApiV2Response<PaginatedData<Article>>;

export interface ArticleDetail extends Article {
  content: string;
  toc?: string;
  next?: { id: number; title: string; pathname?: string };
  prev?: { id: number; title: string; pathname?: string };
}

// ============================================================================
// CSRF Token Response Contract
// ============================================================================

export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface CsrfTokenWrappedResponse {
  data: CsrfTokenResponse;
}

export type CsrfResponse = CsrfTokenResponse | CsrfTokenWrappedResponse;
