import Head from 'next/head';
import { getPublicMeta } from '../../api/getAllData';
import AuthorCard, { type AuthorCardProps } from '../../components/AuthorCard';
import Layout from '../../components/Layout';
import PageNav from '../../components/PageNav';
import PostCard from '../../components/PostCard';
import Waline from '../../components/WaLine';
import type { Article } from '../../types/article';
import { getArticlePath } from '../../utils/getArticlePath';
import type { LayoutProps } from '../../utils/getLayoutProps';
import { getPagePagesProps } from '../../utils/getPageProps';
import { getArticlesKeyWord } from '../../utils/keywords';
import { revalidate } from '../../utils/loadConfig';
import Custom404 from '../404';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { normalizeArticles } from '../../types/contracts';

export interface PagePagesProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  currPage: number;
  articles: Article[];
}

const PagePages = (props: PagePagesProps) => {
  const normalizedArticles = normalizeArticles(props.articles);

  // Convert to Article[] for compatibility with existing functions
  const articlesForKeywords: Article[] = normalizedArticles.map((article) => ({
    ...article,
    tags: [...article.tags],
  }));

  if (normalizedArticles.length === 0) {
    return <Custom404 name="页码" />;
  }

  return (
    <Layout
      option={props.layoutProps}
      title={props.layoutProps.siteName}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <Head>
        <meta name="keywords" content={getArticlesKeyWord(articlesForKeywords).join(',')}></meta>
      </Head>
      <div className="space-y-2 md:space-y-4">
        {normalizedArticles.map((article) => (
          <PostCard
            showEditButton={props.layoutProps.showEditButton === 'true'}
            setContent={() => {}}
            showExpirationReminder={props.layoutProps.showExpirationReminder == 'true'}
            copyrightAggreement={props.layoutProps.copyrightAggreement}
            openArticleLinksInNewWindow={props.layoutProps.openArticleLinksInNewWindow == 'true'}
            customCopyRight={null}
            top={typeof article.top === 'number' ? article.top : article.top ? 1 : 0}
            id={getArticlePath({ ...article, tags: [...article.tags] })}
            key={article.id}
            title={article.title}
            updatedAt={new Date(article.updatedAt)}
            createdAt={new Date(article.createdAt)}
            catelog={article.category}
            content={article.content}
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
}) {
  try {
    const result = {
      props: {
        ...(await getPagePagesProps(params.p)),
        ...(await serverSideTranslations(locale)),
      },
      ...revalidate,
    };
    return result;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return {
      props: {
        ...(await getPagePagesProps('1')),
        ...(await serverSideTranslations(locale)),
      },
      ...revalidate,
    };
  }
}
