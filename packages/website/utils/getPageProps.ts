import {
  getArticleByIdOrPathname,
  getArticlesByCategory,
  getArticlesByOption,
  getArticlesByTimeLine,
  getArticlesByTagName,
  getArticlesByCategoryName,
} from '../api/getArticles';
import { getPublicMeta } from '../api/getAllData';
import { IndexPageProps } from '../pages/index';
import { LinkPageProps } from '../pages/link';
import { TagPageProps } from '../pages/tag';
import { PostPagesProps } from '../pages/post/[id]';
import { CategoryPagesProps } from '../pages/category/[category]';
import { PagePagesProps } from '../pages/page/[p]';
import { TimeLinePageProps } from '../pages/timeline';
import { CategoryPageProps } from '../pages/category';
import {
  getLayoutProps,
  getLayoutPropsFromData,
  getAuthorCardProps,
  LayoutProps,
} from './getLayoutProps';
import { washArticlesByKey } from './washArticles';
import { AboutPageProps } from '../pages/about';
import { isBuildTime } from './loadConfig';
import { TagPagesProps } from '../pages/tag/[tag]';
import { getServerPageview, PageViewData } from '../api/pageView';
import { AuthorCardProps } from '../components/AuthorCard';

const defaultLayoutProps: LayoutProps = {
  description: '',
  ipcNumber: '',
  since: '',
  ipcHref: '',
  gaBeianNumber: '',
  gaBeianUrl: '',
  gaBeianLogoUrl: '',
  copyrightAggreement: '',
  logo: '',
  categories: [],
  favicon: '',
  siteName: '',
  siteDesc: '',
  baiduAnalysisID: '',
  gaAnalysisID: '',
  logoDark: '',
  version: '',
  menus: [],
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

const defaultAuthorCardProps: AuthorCardProps = {
  author: 'Default Author',
  desc: 'Default description',
  logo: '/logo.png',
  logoDark: '/logo-dark.png',
  postNum: 0,
  catelogNum: 0,
  tagNum: 0,
  socials: [],
  showSubMenu: 'false',
  showRSS: 'false',
};

// Add PageViewData to all page props interfaces
export interface CommonPageProps {
  pageViewData: PageViewData;
}

// Helper function to get pageview data
async function getPageViewData(): Promise<PageViewData> {
  if (isBuildTime) {
    return { viewer: 0, visited: 0 };
  }

  try {
    return await getServerPageview();
  } catch (error) {
    console.error('[getPageProps] Failed to get pageview data:', error);
    return { viewer: 0, visited: 0 };
  }
}

export async function getIndexPageProps(): Promise<IndexPageProps> {
  const emptyRet: IndexPageProps = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    articles: [],
    currPage: 1,
    pageViewData: { viewer: 0, visited: 0 },
  };

  if (isBuildTime) {
    return emptyRet;
  }

  try {
    const data = await getPublicMeta();
    const layoutProps = getLayoutPropsFromData(data);
    const authorCardProps = getAuthorCardProps(data);

    let articles = [];
    try {
      const response = await getArticlesByOption({
        page: 1,
        pageSize: 5,
      });

      if (response && response.data) {
        console.log(`[getIndexPageProps] Successfully fetched ${response.data.length} articles`);
        articles = response.data;
      }
      // Check if response has the ArticleResponse structure with nested data
      else if (typeof response === 'object' && 'data' in response && response.data) {
        const articleData = response.data as unknown;
        const typedData = articleData as { data: unknown };
        if (Array.isArray(typedData.data)) {
          console.log(
            `[getIndexPageProps] Found articles in nested data: ${typedData.data.length} articles`,
          );
          articles = typedData.data;
        } else {
          console.error('[getIndexPageProps] Unexpected data structure:', response);
        }
      } else {
        console.error('[getIndexPageProps] Unexpected response structure:', response);
      }
    } catch (error) {
      console.error('[getIndexPageProps] Failed to fetch articles:', error);
    }

    // Fetch pageview data
    const pageViewData = await getPageViewData();

    // Log the final output for debugging
    console.log(`[getIndexPageProps] Returning ${articles.length} articles`);

    return {
      layoutProps,
      articles,
      currPage: 1,
      authorCardProps,
      pageViewData,
    };
  } catch (error) {
    console.error('[getIndexPageProps] Error in getIndexPageProps:', error);
    return emptyRet;
  }
}

export async function getTimeLinePageProps(): Promise<TimeLinePageProps> {
  const emptyRet: TimeLinePageProps = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    timeLine: [],
    pageViewData: { viewer: 0, visited: 0 },
  };

  if (isBuildTime) {
    return emptyRet;
  }

  const data = await getPublicMeta();
  const layoutProps = getLayoutPropsFromData(data);
  const authorCardProps = getAuthorCardProps(data);

  // Get timeline data (returns Record<string, Article[]>)
  const timelineData = await getArticlesByTimeLine();

  // Convert to a flat array of articles
  const timeLine = Object.values(timelineData).flat();

  // Fetch pageview data
  const pageViewData = await getPageViewData();

  return {
    layoutProps,
    timeLine,
    authorCardProps,
    pageViewData,
  };
}

export async function getTagPageProps(): Promise<TagPageProps> {
  const emptyRet: TagPageProps = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    tags: [],
    pageViewData: { viewer: 0, visited: 0 },
  };

  if (isBuildTime) {
    return emptyRet;
  }

  const data = await getPublicMeta();
  const layoutProps = getLayoutPropsFromData(data);
  const authorCardProps = getAuthorCardProps(data);

  // Fetch pageview data
  const pageViewData = await getPageViewData();

  return {
    layoutProps,
    tags: data.tags,
    authorCardProps,
    pageViewData,
  };
}

export async function getCategoryPageProps(): Promise<CategoryPageProps> {
  const emptyRet: CategoryPageProps = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    categories: [],
    articles: [],
    pageViewData: { viewer: 0, visited: 0 },
  };

  if (isBuildTime) {
    return emptyRet;
  }

  const data = await getPublicMeta();
  const layoutProps = getLayoutPropsFromData(data);
  const authorCardProps = getAuthorCardProps(data);

  // Get category data (returns Record<string, Article[]>)
  const categoryData = await getArticlesByCategory();

  // Get all categories from meta data
  const categories = data.meta.categories;

  // Convert to a flat array of articles
  const articles = Object.values(categoryData).flat();

  // Fetch pageview data
  const pageViewData = await getPageViewData();

  return {
    layoutProps,
    articles,
    categories,
    authorCardProps,
    pageViewData,
  };
}

export async function getLinkPageProps(): Promise<LinkPageProps> {
  const emptyRet: LinkPageProps = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    links: [],
    pageViewData: { viewer: 0, visited: 0 },
  };

  if (isBuildTime) {
    return emptyRet;
  }

  const data = await getPublicMeta();
  const layoutProps = getLayoutPropsFromData(data);
  const authorCardProps = getAuthorCardProps(data);

  // Fetch pageview data
  const pageViewData = await getPageViewData();

  return {
    layoutProps,
    authorCardProps,
    links: data.meta.links,
    pageViewData,
  };
}

export async function getAboutPageProps(): Promise<AboutPageProps> {
  const emptyRet: AboutPageProps = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    showDonateInfo: 'false',
    about: { content: '', updatedAt: new Date().toISOString() },
    donates: [],
    showDonateInAbout: 'false',
    pay: ['', ''],
    payDark: ['', ''],
    pageViewData: { viewer: 0, visited: 0 },
  };

  if (isBuildTime) {
    return emptyRet;
  }

  const data = await getPublicMeta();
  const layoutProps = getLayoutPropsFromData(data);
  const authorCardProps = getAuthorCardProps(data);
  const about = data.meta.about;
  let showDonateInfo: 'true' | 'false' = 'true';
  if (data.meta.siteInfo?.showDonateInfo == 'false') {
    showDonateInfo = 'false';
  }
  let showDonateInAbout: 'true' | 'false' = 'false';

  if (data.meta.siteInfo?.showDonateInAbout == 'true') {
    showDonateInAbout = 'true';
  }
  if (data.meta.siteInfo?.showDonateButton == 'false') {
    showDonateInAbout = 'false';
  }
  const payProps = {
    pay: [data.meta.siteInfo?.payAliPay || '', data.meta.siteInfo?.payWechat || ''],
    payDark: [data.meta.siteInfo?.payAliPayDark || '', data.meta.siteInfo?.payWechatDark || ''],
  };

  // Fetch pageview data
  const pageViewData = await getPageViewData();

  return {
    showDonateInfo,
    layoutProps,
    authorCardProps,
    about,
    donates: data.meta?.rewards || [],
    showDonateInAbout,
    ...payProps,
    pageViewData,
  };
}

export async function getTagPagesProps(currTag: string): Promise<TagPagesProps> {
  try {
    const data = await getPublicMeta();
    const layoutProps = getLayoutPropsFromData(data);
    const authorCardProps = getAuthorCardProps(data);
    const articles = await getArticlesByTagName(currTag);
    const sortedArticles = washArticlesByKey(
      articles,
      (article) => new Date(article.createdAt).getFullYear().toString(),
      false,
    );
    const wordTotal = data.totalWordCount;

    return {
      layoutProps,
      authorCardProps,
      sortedArticles,
      currTag,
      wordTotal,
      curNum: articles.length,
    };
  } catch (err) {
    console.log(err);
    return {
      layoutProps: await getLayoutProps(),
      authorCardProps: defaultAuthorCardProps,
      sortedArticles: {},
      currTag,
      wordTotal: 0,
      curNum: 0,
    };
  }
}

export async function getPostPagesProps(curId: string): Promise<PostPagesProps> {
  console.log(`[getPostPagesProps] Fetching post props for ID: ${curId}`);

  try {
    const data = await getPublicMeta();
    const layoutProps = getLayoutPropsFromData(data);
    let articleData;

    try {
      console.log(`[getPostPagesProps] Fetching article details for ID: ${curId}`);
      articleData = await getArticleByIdOrPathname(curId);

      if (!articleData) {
        console.error(`[getPostPagesProps] No article data returned for ID: ${curId}`);
        // Create a default empty article
        articleData = {
          id: 0,
          title: 'Article Not Found',
          content: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          category: '',
          tags: [],
          private: false,
          top: 0,
        };
      } else {
        console.log(
          `[getPostPagesProps] Successfully fetched article: "${articleData.title}" (ID: ${articleData.id})`,
        );
      }

      // Ensure content is at least an empty string if undefined
      if (articleData.content === undefined) {
        articleData.content = '';
      }
    } catch (e) {
      console.error(`[getPostPagesProps] Error fetching article with ID ${curId}:`, e);
      // Create a default empty article on error
      articleData = {
        id: 0,
        title: 'Error Loading Article',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        category: '',
        tags: [],
        private: false,
        top: 0,
      };
    }

    const author = articleData?.author || data.meta.siteInfo.author || '';
    const payProps = {
      pay: [data.meta.siteInfo?.payAliPay || '', data.meta.siteInfo?.payWechat || ''],
      payDark: [data.meta.siteInfo?.payAliPayDark || '', data.meta.siteInfo?.payWechatDark || ''],
    };

    // Handle prev/next navigation
    const prev = articleData.prev || { id: 0, title: '', pathname: '' };
    const next = articleData.next || { id: 0, title: '', pathname: '' };

    // Remove prev/next from the article object to avoid duplication
    const { ...articleWithoutNavigation } = articleData;

    const result = {
      layoutProps,
      article: articleWithoutNavigation,
      ...payProps,
      author,
      showSubMenu: layoutProps.showSubMenu,
      pre: prev,
      next: next,
    };

    console.log(
      `[getPostPagesProps] Props prepared successfully for article "${articleData.title}"`,
    );
    return result;
  } catch (error) {
    console.error(`[getPostPagesProps] Failed to get post page props for ID ${curId}:`, error);
    throw error;
  }
}

export async function getPagePagesProps(curId: string): Promise<PagePagesProps> {
  const defaultReturn = {
    layoutProps: defaultLayoutProps,
    authorCardProps: defaultAuthorCardProps,
    articles: [],
    currPage: parseInt(curId) || 1,
  };

  if (isBuildTime) {
    return defaultReturn;
  }

  try {
    const data = await getPublicMeta();
    console.log(data);
    const layoutProps = getLayoutPropsFromData(data);
    console.log(layoutProps);
    const authorCardProps = getAuthorCardProps(data);
    console.log(authorCardProps);

    let articles = [];
    try {
      const response = await getArticlesByOption({
        page: parseInt(curId) || 1,
        pageSize: 5,
      });

      // Check that the response and response.data exist
      if (response && response.data) {
        articles = response.data;
      } else {
        console.warn(`No articles found for page ${curId}, using empty array`);
      }
    } catch (error) {
      console.error(`[getPagePagesProps] Failed to fetch articles for page ${curId}:`, error);
    }

    return {
      layoutProps,
      authorCardProps,
      articles: articles || [], // Ensure we always return an array
      currPage: parseInt(curId) || 1,
    };
  } catch (error) {
    console.error(`[getPagePagesProps] Error in getPagePagesProps for page ${curId}:`, error);
    return defaultReturn;
  }
}

export async function getCategoryPagesProps(curCategory: string): Promise<CategoryPagesProps> {
  try {
    const data = await getPublicMeta();
    const layoutProps = getLayoutPropsFromData(data);
    const authorCardProps = getAuthorCardProps(data);
    const articles = await getArticlesByCategoryName(curCategory);
    const sortedArticles = washArticlesByKey(
      articles,
      (article) => new Date(article.createdAt).getFullYear().toString(),
      false,
    );
    const wordTotal = data.totalWordCount;

    return {
      layoutProps,
      authorCardProps,
      sortedArticles,
      curCategory,
      wordTotal,
      curNum: articles.length,
    };
  } catch (err) {
    console.log(err);
    return {
      layoutProps: await getLayoutProps(),
      authorCardProps: defaultAuthorCardProps,
      sortedArticles: {},
      curCategory,
      wordTotal: 0,
      curNum: 0,
    };
  }
}
