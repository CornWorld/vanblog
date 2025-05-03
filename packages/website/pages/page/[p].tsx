import Head from 'next/head';
import { getPublicMeta } from '../../api/getAllData';
import AuthorCard, { AuthorCardProps } from '../../components/AuthorCard';
import Layout from '../../components/Layout';
import PageNav from '../../components/PageNav';
import PostCard from '../../components/PostCard';
import Waline from '../../components/WaLine';
import { Article } from '../../types/article';
import { getArticlePath } from '../../utils/getArticlePath';
import { LayoutProps } from '../../utils/getLayoutProps';
import { getPagePagesProps } from '../../utils/getPageProps';
import { getArticlesKeyWord } from '../../utils/keywords';
import { revalidate } from '../../utils/loadConfig';
import Custom404 from '../404';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
export interface PagePagesProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  currPage: number;
  articles: Article[];
}
const PagePages = (props: PagePagesProps) => {
  // Add safety check for articles array
  const articles = props.articles || [];

  if (!articles || articles.length === 0) {
    return <Custom404 name="页码" />;
  }
  return (
    <Layout
      option={props.layoutProps}
      title={props.layoutProps.siteName}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <Head>
        <meta name="keywords" content={getArticlesKeyWord(articles).join(',')}></meta>
      </Head>
      <div className="space-y-2 md:space-y-4">
        {articles.map((article) => (
          <PostCard
            showEditButton={props.layoutProps.showEditButton === 'true'}
            setContent={() => {}}
            showExpirationReminder={props.layoutProps.showExpirationReminder == 'true'}
            copyrightAggreement={props.layoutProps.copyrightAggreement}
            openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow == 'true'}
            customCopyRight={null}
            top={typeof article.top === 'number' ? article.top : article.top ? 1 : 0}
            id={getArticlePath(article)}
            key={article.id}
            title={article.title}
            updatedAt={new Date(article.updatedAt)}
            createdAt={new Date(article.createdAt)}
            catelog={article.category}
            content={article.content || ''}
            type={'overview'}
            enableComment={props.layoutProps.enableComment}
            private={article.private}
          ></PostCard>
        ))}
      </div>
      <PageNav
        total={props.authorCardProps.postNum}
        current={props.currPage}
        base={'/'}
        more={'/page'}
      ></PageNav>
      <Waline enable={props.layoutProps.enableComment} visible={false} />
    </Layout>
  );
};

export default PagePages;

export async function getStaticPaths() {
  const data = await getPublicMeta();
  const totalArticles = data?.totalArticles || 0;
  const total = Math.ceil(totalArticles / 5);
  const paths = [];
  for (let i = 1; i <= total; i++) {
    paths.push({
      params: {
        p: String(i),
      },
    });
  }
  return {
    paths,
    fallback: 'blocking',
  };
}

export async function getStaticProps({
  params,
  locale,
}: {
  params: { p: string };
  locale: string;
}): Promise<{ props: PagePagesProps; revalidate?: number } | { notFound: true }> {
  try {
    // Check if params.p exists
    if (!params || !params.p) {
      console.error('Error: Page number is undefined');
      return {
        notFound: true,
      };
    }

    const props = await getPagePagesProps(params.p);
    return {
      props,
      ...revalidate,
      ...(await serverSideTranslations(locale)),
    };
  } catch (error) {
    console.error('Error getting page props:', error);
    return {
      notFound: true,
    };
  }
}
