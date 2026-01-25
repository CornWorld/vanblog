export interface SiteMeta {
  id: number;
  key: string;
  value: string | null;
  createdAt: string;
  updatedAt: string;
}

// 基础站点信息
export interface SiteInfo {
  title: string;
  description: string;
  author: string;
  keywords: string[];
  logo?: string;
  favicon?: string;
  since?: string;
  baseUrl?: string;
}

// 备案信息
export interface BeianInfo {
  icp?: string;
  icpUrl?: string;
  gaBeianNumber?: string;
  gaBeianUrl?: string;
  gaBeianLogoUrl?: string;
}

// 分析配置
export interface AnalyticsConfig {
  googleAnalyticsId?: string;
  baiduAnalyticsId?: string;
}

// 显示配置
export interface DisplayConfig {
  enableComment?: boolean;
  showSubMenu?: boolean;
  headerLeftContent?: 'siteLogo' | 'siteName';
  subMenuOffset?: number;
  showAdminButton?: boolean;
  showDonateInfo?: boolean;
  showFriends?: boolean;
  showCopyRight?: boolean;
  showRSS?: boolean;
  openArticleLinksInNewWindow?: boolean;
  showExpirationReminder?: boolean;
  showEditButton?: boolean;
  defaultTheme?: 'auto' | 'dark' | 'light';
  enableCustomizing?: boolean;
}

// 支付信息
export interface PaymentInfo {
  payAliPay?: string;
  payWechat?: string;
  payAliPayDark?: string;
  payWechatDark?: string;
  showDonateButton?: boolean;
  showDonateInAbout?: boolean;
}

// 关于页面
export interface AboutInfo {
  content: string;
  updatedAt: string;
}

// 社交链接
export interface SocialLink {
  type: string;
  value: string;
  icon?: string;
}

// 打赏信息
export interface RewardInfo {
  name: string;
  value: string;
  updatedAt?: string;
}

export interface SiteLayout {
  showRecentPosts: boolean;
  recentPostsCount: number;
  showCategories: boolean;
  showTags: boolean;
  showArchive: boolean;
  showAbout: boolean;
  showSearch: boolean;
}

export interface SiteTheme {
  primaryColor: string;
  darkMode: boolean;
  customCss?: string;
  customHtml?: string;
  headerCode?: string;
  footerCode?: string;
}

export interface FriendLink {
  name: string;
  url: string;
  description?: string;
  avatar?: string;
}

export interface Navigation {
  name: string;
  path: string;
  icon?: string;
  external?: boolean;
  children?: Navigation[];
}

export interface CustomCode {
  customCss?: string;
  customHtml?: string;
  headerCode?: string;
  footerCode?: string;
}
