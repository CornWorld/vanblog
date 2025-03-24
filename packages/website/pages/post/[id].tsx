import Head from 'next/head';
import { useEffect, useState } from 'react';
import { getArticlesByOption } from '../../api/getArticles';
import Layout from '../../components/Layout';
import PostCard from '../../components/PostCard';
import Toc from '../../components/Toc';
import { Article } from '../../types/article';
import { getArticlePath } from '../../utils/getArticlePath';
import { LayoutProps } from '../../utils/getLayoutProps';
import { getPostPagesProps } from '../../utils/getPageProps';
import { hasToc } from '../../utils/hasToc';
import { getArticlesKeyWord } from '../../utils/keywords';
import { revalidate, isBuildTime, isDevelopment } from '../../utils/loadConfig';
import Custom404 from '../404';

// Default layout props for loading state
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

export interface PostPagesProps {
  layoutProps: LayoutProps;
  article: Article;
  pay: string[];
  payDark: string[];
  author: string;
  pre: {
    id: number;
    title: string;
    pathname?: string;
  };
  next: {
    id: number;
    title: string;
    pathname?: string;
  };
  showSubMenu: 'true' | 'false';
  error?: string;
}

const PostPages = (props: PostPagesProps) => {
  const [url, setUrl] = useState('');
  const [content, setContent] = useState(props.article?.content || '');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUrl(window.location.origin);
    setContent(props.article?.content || '');
    setIsLoading(false);

    if (isDevelopment) {
      if (props.error) {
        console.error(`[PostPages] Error received from props: ${props.error}`);
      }

      if (!props.article || !props.article.id) {
        console.error('[PostPages] No valid article data received');
      } else {
        console.log(
          `[PostPages] Displaying article: "${props.article.title}" (ID: ${props.article.id})`,
        );
      }
    }
  }, [props.article, props.error]);

  // Show loading state while processing
  if (isLoading) {
    return (
      <Layout option={props.layoutProps || defaultLayoutProps} title="Loading..." sideBar={null}>
        <div className="loading">Loading article...</div>
      </Layout>
    );
  }

  if (!props.article || !props.article.id) {
    // Add more detailed information in the error page for debugging
    if (isDevelopment) {
      return (
        <div>
          <h1>Article Not Found</h1>
          <p>The requested article could not be found.</p>
          {props.error && <p>Error: {props.error}</p>}
          <pre>{JSON.stringify(props, null, 2)}</pre>
        </div>
      );
    }
    return <Custom404 />;
  }

  const keywords = getArticlesKeyWord([props.article].filter(Boolean));
  const path = getArticlePath(props.article);
  const showToc = hasToc(content);

  // Create a safe reference to the article with default values
  const article = {
    title: props.article.title || '',
    content: props.article.content || '',
    updatedAt: props.article.updatedAt || new Date().toISOString(),
    createdAt: props.article.createdAt || new Date().toISOString(),
    category: props.article.category || '',
    private: props.article.private || false,
    top: props.article.top,
    copyright: props.article.copyright,
    tags: props.article.tags || [],
    ...props.article,
  };

  return (
    <Layout
      option={props.layoutProps}
      title={article.title}
      sideBar={showToc ? <Toc content={content} showSubMenu={props.showSubMenu} /> : undefined}
    >
      <Head>
        <meta name="keywords" content={keywords.join(',')} />
        <meta name="description" content={article.content ? article.content.slice(0, 100) : ''} />
        <meta property="og:title" content={article.title} />
        <meta
          property="og:description"
          content={article.content ? article.content.slice(0, 100) : ''}
        />
        <meta property="og:url" content={`${url}${path}`} />
      </Head>
      <PostCard
        showEditButton={props.layoutProps.showEditButton === 'true'}
        showExpirationReminder={props.layoutProps.showExpirationReminder === 'true'}
        copyrightAggreement={props.layoutProps.copyrightAggreement}
        openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow === 'true'}
        customCopyRight={article.copyright}
        top={typeof article.top === 'number' ? article.top : article.top ? 1 : 0}
        id={path}
        title={article.title}
        updatedAt={new Date(article.updatedAt)}
        createdAt={new Date(article.createdAt)}
        catelog={article.category}
        content={content}
        setContent={setContent}
        type="article"
        pay={props.pay}
        payDark={props.payDark}
        private={article.private}
        author={props.author}
        tags={article.tags}
        pre={props.pre}
        next={props.next}
        enableComment={props.layoutProps.enableComment}
        hideDonate={props.layoutProps.showDonateButton !== 'true'}
        hideCopyRight={props.layoutProps.showCopyRight !== 'true'}
      />
    </Layout>
  );
};

export default PostPages;

export async function getStaticPaths() {
  if (isBuildTime) {
    // During build time, return an empty array of paths
    return {
      paths: [],
      fallback: 'blocking',
    };
  }

  try {
    // In development or when not in build time, get all articles
    console.log('[getStaticPaths] Fetching articles to generate paths');
    const response = await getArticlesByOption({
      page: 1,
      pageSize: -1, // Get all articles
    });

    if (!response || !response.data) {
      console.warn('[getStaticPaths] No articles returned from API');
      return {
        paths: [],
        fallback: 'blocking',
      };
    }

    console.log(`[getStaticPaths] Found ${response.data.length} articles`);
    const paths = response.data.map((article) => {
      const id = article.pathname || article.id.toString();
      console.log(`[getStaticPaths] Adding path for article: ${article.title} (${id})`);
      return {
        params: { id },
      };
    });

    return {
      paths,
      fallback: 'blocking',
    };
  } catch (error) {
    console.error('[getStaticPaths] Error getting article paths:', error);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
}

export async function getStaticProps({
  params,
}: {
  params: { id: string };
}): Promise<{ props: PostPagesProps; revalidate?: number } | { notFound: true }> {
  try {
    // If params.id is undefined, return notFound
    if (!params || !params.id) {
      console.error('[getStaticProps] Error: Article ID is undefined');
      return {
        notFound: true,
      };
    }

    console.log(`[getStaticProps] Fetching post props for ID: ${params.id}`);
    const props = await getPostPagesProps(params.id);

    if (!props || !props.article || !props.article.id) {
      console.error(`[getStaticProps] Failed to get valid article data for ID: ${params.id}`);
      return {
        notFound: true,
      };
    }

    // Ensure all properties are serializable by converting undefined values to null
    const sanitizedProps = JSON.parse(
      JSON.stringify(props, (_, value) => (value === undefined ? null : value)),
    );

    console.log(`[getStaticProps] Successfully fetched article: ${props.article.title}`);
    return {
      props: sanitizedProps,
      revalidate: typeof revalidate === 'number' ? revalidate : 60,
    };
  } catch (error) {
    console.error(`[getStaticProps] Error getting post props: ${error}`);
    // Instead of returning notFound, return a valid props object with error information
    // This helps with debugging while still showing something to the user
    try {
      // Get basic layout props to render a minimal error page
      const props = await getPostPagesProps('error');
      return {
        props: {
          ...props,
          error: error instanceof Error ? error.message : String(error),
        },
        revalidate: 30, // Try again sooner
      };
    } catch {
      // If we can't even get basic props, then return notFound
      return {
        notFound: true,
      };
    }
  }
}
