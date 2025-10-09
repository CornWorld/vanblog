import { defaultMenu, MenuItem, PublicMetaProp } from '../api/getAllData';
import dayjs from 'dayjs';
import { AuthorCardProps } from '../components/AuthorCard';
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
  // 防御：容忍 data/meta/siteInfo 为空，提供安全默认值
  const safeMeta =
    data?.meta ||
    ({
      links: [],
      socials: [],
      rewards: [],
      categories: [],
      about: { updatedAt: dayjs().toISOString(), content: '' },
      siteInfo: {
        author: '',
        authorDesc: '',
        authorLogo: '',
        siteLogo: '',
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
        since: dayjs().format('YYYY'),
        baseUrl: '',
        copyrightAggreement: 'BY-NC-SA',
        showFriends: 'false',
        enableComment: 'false',
        defaultTheme: 'auto',
        enableCustomizing: 'false',
        showDonateButton: 'false',
        showCopyRight: 'false',
        showRSS: 'false',
        openArticleLinksInNewWindow: 'false',
        showExpirationReminder: 'false',
        showEditButton: 'false',
      },
    } as PublicMetaProp['meta']);

  const siteInfo = safeMeta.siteInfo || ({} as PublicMetaProp['meta']['siteInfo']);
  const showSubMenu = Boolean(safeMeta.categories?.length) && siteInfo?.showSubMenu == 'true';
  let headerLeftContent: 'siteLogo' | 'siteName' = 'siteName';
  if (siteInfo?.siteLogo && siteInfo?.headerLeftContent == 'siteLogo') {
    headerLeftContent = 'siteLogo';
  }
  let showAdminButton: 'true' | 'false' = 'true';
  if (siteInfo?.showAdminButton && siteInfo.showAdminButton == 'false') {
    showAdminButton = 'false';
  }
  let showFriends: 'true' | 'false' = 'true';
  if (siteInfo?.showFriends == 'false') {
    showFriends = 'false';
  }
  const customSetting: {
    enableCustomizing: 'true' | 'false';
    customCss?: string;
    customHtml?: string;
    customHead?: HeadTag[];
    customScript?: string;
  } = { enableCustomizing: 'true' };
  if (siteInfo.enableCustomizing && siteInfo.enableCustomizing == 'false') {
    customSetting.enableCustomizing = 'false';
  }
  if (data?.layout?.css) {
    customSetting.customCss = data?.layout?.css;
  }
  if (data?.layout?.html) {
    customSetting.customHtml = data?.layout?.html;
  }
  if (data?.layout?.head) {
    customSetting.customHead = data?.layout?.head;
  }
  if (data?.layout?.script) {
    customSetting.customScript = data?.layout?.script;
  }
  let showDonateButton: 'true' | 'false' = 'true';
  let showCopyRight: 'true' | 'false' = 'true';
  if (siteInfo?.showCopyRight == 'false') {
    showCopyRight = 'false';
  }
  if (siteInfo?.showDonateButton == 'false') {
    showDonateButton = 'false';
  }
  let showRSS: 'true' | 'false' = 'true';
  if (siteInfo?.showRSS && siteInfo?.showRSS == 'false') {
    showRSS = 'false';
  }
  let showExpirationReminder: 'true' | 'false' = 'true';
  if (siteInfo?.showExpirationReminder && siteInfo?.showExpirationReminder == 'false') {
    showExpirationReminder = 'false';
  }
  let showEditButton: 'true' | 'false' = 'true';
  if (siteInfo?.showEditButton && siteInfo?.showEditButton == 'false') {
    showEditButton = 'false';
  }
  let openArticleLinksInNewWindow: 'true' | 'false' = 'false';
  if (siteInfo?.openArticleLinksInNewWindow && siteInfo?.openArticleLinksInNewWindow == 'true') {
    openArticleLinksInNewWindow = 'true';
  }

  const walineConfig = data?.walineConfig || {};

  // Coerce possibly string-typed flags from siteInfo into narrow unions required by LayoutProps
  const enableCommentVal: 'true' | 'false' = siteInfo?.enableComment === 'false' ? 'false' : 'true';
  const defaultThemeVal: 'auto' | 'dark' | 'light' =
    siteInfo?.defaultTheme === 'dark'
      ? 'dark'
      : siteInfo?.defaultTheme === 'light'
        ? 'light'
        : 'auto';

  return {
    showFriends,
    version: data?.version || 'dev',
    subMenuOffset: siteInfo?.subMenuOffset || 0,
    showAdminButton,
    headerLeftContent,
    copyrightAggreement: siteInfo?.copyrightAggreement || 'BY-NC-SA',
    ipcHref: siteInfo?.beianUrl || '',
    ipcNumber: siteInfo?.beianNumber || '',
    gaBeianNumber: siteInfo?.gaBeianNumber || '',
    gaBeianLogoUrl: siteInfo?.gaBeianLogoUrl || '',
    gaBeianUrl: siteInfo?.gaBeianUrl || '',
    since: siteInfo?.since || dayjs().toISOString(),
    logo: siteInfo?.siteLogo || '',
    favicon: siteInfo?.favicon || '/logo.svg',
    siteName: siteInfo?.siteName || 'VanBlog',
    siteDesc: siteInfo?.siteDesc || '',
    baiduAnalysisID: siteInfo?.baiduAnalysisId || '',
    gaAnalysisID: siteInfo?.gaAnalysisId || '',
    logoDark: siteInfo?.siteLogoDark || '',
    showExpirationReminder: showExpirationReminder,
    description: siteInfo?.siteDesc || '',
    menus: data?.menus || defaultMenu,
    categories: safeMeta?.categories || [],
    showSubMenu: showSubMenu ? 'true' : 'false',
    enableComment: enableCommentVal,
    defaultTheme: defaultThemeVal,
    openArticleLinksInNewWindow,
    showCopyRight,
    showDonateButton,
    showRSS,
    showEditButton,
    ...customSetting,
    walineServerURL: walineConfig.serverURL || '',
  };
}

export function getAuthorCardProps(data: PublicMetaProp): AuthorCardProps {
  const meta = data?.meta || ({} as any);
  const categoriesLen = Array.isArray(meta?.categories) ? meta.categories.length : 0;
  const showSubMenu = Boolean(categoriesLen) && meta?.siteInfo?.showSubMenu == 'true';
  let showRSS: 'true' | 'false' = 'true';
  if (meta?.siteInfo?.showRSS && meta?.siteInfo?.showRSS == 'false') {
    showRSS = 'false';
  }
  return {
    postNum: data?.totalArticles ?? 0,
    tagNum: Array.isArray(data?.tags) ? data.tags.length : 0,
    catelogNum: categoriesLen,
    socials: meta?.socials || [],
    author: meta?.siteInfo?.author || '',
    desc: meta?.siteInfo?.authorDesc || '',
    logo: meta?.siteInfo?.authorLogo || '',
    logoDark: meta?.siteInfo?.authorLogoDark || '',
    showSubMenu: showSubMenu ? 'true' : 'false',
    showRSS,
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
