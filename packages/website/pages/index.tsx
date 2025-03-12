import AuthorCard, { AuthorCardProps } from "../components/AuthorCard";
import Layout from "../components/Layout";
import PageNav from "../components/PageNav";
import PostCard from "../components/PostCard";
import { Article } from "../types/article";
import { LayoutProps } from "../utils/getLayoutProps";
import { getIndexPageProps } from "../utils/getPageProps";
import { revalidate } from "../utils/loadConfig";
import Waline from "../components/WaLine";
import Head from "next/head";
import { getArticlesKeyWord } from "../utils/keywords";
import { getArticlePath } from "../utils/getArticlePath";
import { useState } from "react";
import { PageViewData } from "../api/pageview";

export interface IndexPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  currPage: number;
  articles: Article[];
  pageViewData: PageViewData;
}

const Home = (props: IndexPageProps) => {
  const [articles, setArticles] = useState(props.articles || []);

  return (
    <Layout
      option={props.layoutProps}
      title={props.layoutProps.siteName}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <Head>
        <meta
          name="keywords"
          content={getArticlesKeyWord(articles).join(",")}
        ></meta>
      </Head>
      <div className="space-y-2 md:space-y-4">
        {articles.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            暂无文章
          </div>
        ) : (
          articles.map((article) => (
            <PostCard
              showEditButton={props.layoutProps.showEditButton === "true"}
              setContent={() => {}}
              showExpirationReminder={
                props.layoutProps.showExpirationReminder == "true"
              }
              openArticleLinksInNewWindow={
                props.layoutProps.openArticleLinksInNewWindow == "true"
              }
              customCopyRight={null}
              private={article.private}
              top={article.top || 0}
              id={getArticlePath(article)}
              key={article.id}
              title={article.title}
              updatedAt={new Date(article.updatedAt)}
              createdAt={new Date(article.createdAt)}
              catelog={article.category}
              content={article.content || ""}
              type={"overview"}
              enableComment={props.layoutProps.enableComment}
              copyrightAggreement={props.layoutProps.copyrightAggreement}
            ></PostCard>
          ))
        )}
      </div>
      <PageNav
        total={props.authorCardProps.postNum}
        current={props.currPage}
        base={"/"}
        more={"/page"}
      ></PageNav>
      <Waline enable={props.layoutProps.enableComment} visible={false} />
    </Layout>
  );
};

export default Home;

export async function getStaticProps(): Promise<{
  props: IndexPageProps;
  revalidate?: number;
}> {
  return {
    props: await getIndexPageProps(),
    ...revalidate,
  };
}
