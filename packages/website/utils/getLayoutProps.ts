import { defaultMenu, type MenuItem, type PublicMetaProp } from '../api/getAllData';
import { normalizePublicMeta } from '../types/contracts';
import dayjs from 'dayjs';
import type { AuthorCardProps } from '../components/AuthorCard';
import { getPublicMeta } from '../api/getAllData';

export interface LayoutProps {
  description: string;
  ipcNumber: string;
  since: string;
  ipcHref: string;
  // 公安备案
  gaBeianNumber: string;
  gaBeianUrl: string;
  gaBeianLogoUrl: string;
  copyrightAggreement: string;
  logo: string;
  categories: string[];
  favicon: string;
  siteName: string;
  siteDesc: string;
  baiduAnalysisID: string;
  gaAnalysisID: string;
  logoDark: string;
  version: string;
  menus: MenuItem[];
  showSubMenu: 'true' | 'false';
  showAdminButton: 'true' | 'false';
  showFriends: 'true' | 'false';
  headerLeftContent: 'siteLogo' | 'siteName';
  enableComment: 'true' | 'false';
  defaultTheme: 'auto' | 'dark' | 'light';
  enableCustomizing: 'true' | 'false';
  showDonateButton: 'true' | 'false';
  showCopyRight: 'true' | 'false';
  showRSS: 'true' | 'false';
  showExpirationReminder: 'true' | 'false';
  openArticleLinksInNewWindow: 'true' | 'false';
  showEditButton: 'true' | 'false';
  subMenuOffset: number;
  customCss?: string;
  customScript?: string;
  customHtml?: string;
  customHead?: HeadTag[];
  walineServerURL: string;
}

export interface HeadTag {
  name: string;
  props: Record<string, string>;
  content: string;
}

export function getLayoutPropsFromData(data: PublicMetaProp): LayoutProps {
  // 使用新的数据契约规范化函数，消除防御性编程
  const normalizedData = normalizePublicMeta(data);
  const { meta, layout, walineConfig, version, menus } = normalizedData;
  const { siteInfo, categories } = meta;

  const showSubMenu = Boolean(categories.length) && siteInfo.showSubMenu;
  const headerLeftContent: 'siteLogo' | 'siteName' =
    siteInfo.siteLogo && siteInfo.headerLeftContent === 'siteLogo' ? 'siteLogo' : 'siteName';

  const customSetting: {
    enableCustomizing: 'true' | 'false';
    customCss?: string;
    customHtml?: string;
    customHead?: HeadTag[];
    customScript?: string;
  } = {
    enableCustomizing: siteInfo.enableCustomizing ? 'true' : 'false',
    customCss: layout.css || undefined,
    customHtml: layout.html || undefined,
    customHead: layout.head.length > 0 ? [...layout.head] : undefined,
    customScript: layout.script || undefined,
  };

  return {
    showFriends: siteInfo.showFriends ? 'true' : 'false',
    version,
    subMenuOffset: siteInfo.subMenuOffset,
    showAdminButton: siteInfo.showAdminButton ? 'true' : 'false',
    headerLeftContent,
    copyrightAggreement: siteInfo.copyrightAggreement,
    ipcHref: siteInfo.beianUrl,
    ipcNumber: siteInfo.beianNumber,
    gaBeianNumber: siteInfo.gaBeianNumber,
    gaBeianLogoUrl: siteInfo.gaBeianLogoUrl,
    gaBeianUrl: siteInfo.gaBeianUrl,
    since: siteInfo.since,
    logo: siteInfo.siteLogo,
    favicon: siteInfo.favicon,
    siteName: siteInfo.siteName,
    siteDesc: siteInfo.siteDesc,
    baiduAnalysisID: siteInfo.baiduAnalysisId,
    gaAnalysisID: siteInfo.gaAnalysisId,
    logoDark: siteInfo.siteLogoDark,
    showExpirationReminder: siteInfo.showExpirationReminder ? 'true' : 'false',
    description: siteInfo.siteDesc,
    menus: menus as MenuItem[],
    categories: [...categories],
    showSubMenu: showSubMenu ? 'true' : 'false',
    enableComment: siteInfo.enableComment ? 'true' : 'false',
    defaultTheme: siteInfo.defaultTheme,
    openArticleLinksInNewWindow: siteInfo.openArticleLinksInNewWindow ? 'true' : 'false',
    showCopyRight: siteInfo.showCopyRight ? 'true' : 'false',
    showDonateButton: siteInfo.showDonateButton ? 'true' : 'false',
    showRSS: siteInfo.showRSS ? 'true' : 'false',
    showEditButton: siteInfo.showEditButton ? 'true' : 'false',
    ...customSetting,
    walineServerURL: walineConfig.serverURL,
  };
}

export function getAuthorCardProps(data: PublicMetaProp): AuthorCardProps {
  const normalizedData = normalizePublicMeta(data);
  const { meta, tags, totalArticles } = normalizedData;
  const { categories, siteInfo, socials } = meta;

  const categoriesLen = categories.length;
  const showSubMenu = Boolean(categoriesLen) && siteInfo.showSubMenu;

  return {
    postNum: totalArticles,
    tagNum: tags.length,
    catelogNum: categoriesLen,
    socials: [...socials],
    author: siteInfo.author,
    desc: siteInfo.authorDesc,
    logo: siteInfo.authorLogo,
    logoDark: siteInfo.authorLogoDark,
    showSubMenu: showSubMenu ? 'true' : 'false',
    showRSS: siteInfo.showRSS ? 'true' : 'false',
  };
}

// Async function to fetch and get layout props
export async function getLayoutProps(): Promise<LayoutProps> {
  try {
    const meta = await getPublicMeta();
    return getLayoutPropsFromData(meta);
  } catch (err) {
    console.log(err);
    // Return default values for all required properties
    return {
      description: '',
      ipcNumber: '',
      since: dayjs().toISOString(),
      ipcHref: '',
      gaBeianNumber: '',
      gaBeianUrl: '',
      gaBeianLogoUrl: '',
      copyrightAggreement: 'BY-NC-SA',
      logo: '',
      categories: [],
      favicon: '',
      siteName: '',
      siteDesc: '',
      baiduAnalysisID: '',
      gaAnalysisID: '',
      logoDark: '',
      version: 'dev',
      menus: defaultMenu,
      showSubMenu: 'false',
      showAdminButton: 'false',
      showFriends: 'false',
      headerLeftContent: 'siteName',
      enableComment: 'false',
      defaultTheme: 'auto',
      enableCustomizing: 'false',
      showDonateButton: 'false',
      showCopyRight: 'false',
      showRSS: 'false',
      showExpirationReminder: 'false',
      openArticleLinksInNewWindow: 'false',
      showEditButton: 'false',
      subMenuOffset: 0,
      walineServerURL: '',
    };
  }
}
