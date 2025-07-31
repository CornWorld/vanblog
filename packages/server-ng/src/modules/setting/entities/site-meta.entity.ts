export interface SiteMeta {
  id: number;
  key: string;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SiteInfo {
  title: string;
  description: string;
  author: string;
  keywords: string[];
  logo?: string;
  favicon?: string;
  since?: string;
  icp?: string;
  googleAnalyticsId?: string;
  baiduAnalyticsId?: string;
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
