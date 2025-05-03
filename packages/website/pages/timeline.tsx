import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import TimeLineItem from '../components/TimeLineItem';
import { Article } from '../types/article';
import { LayoutProps } from '../utils/getLayoutProps';
import { getTimeLinePageProps } from '../utils/getPageProps';
import { revalidate } from '../utils/loadConfig';
import { PageViewData } from '../api/pageView';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

export interface TimeLinePageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  timeLine: Article[];
  pageViewData: PageViewData;
}

const TimeLine = (props: TimeLinePageProps) => {
  const { t } = useTranslation();

  // Group articles by year
  const sortedArticles: Record<string, Article[]> = {};
  props.timeLine.forEach((article) => {
    const year = new Date(article.createdAt).getFullYear().toString();
    if (!sortedArticles[year]) {
      sortedArticles[year] = [];
    }
    sortedArticles[year].push(article);
  });

  // Calculate total word count (using safe property access)
  const wordTotal = props.timeLine.reduce((total, article) => {
    return total + (article.wordCount || 0);
  }, 0);

  return (
    <Layout
      title={t('pages.timeline.title')}
      option={props.layoutProps}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div>
          <div className="text-2xl md:text-3xl text-gray-700 text-center dark:text-dark">
            {t('pages.timeline.title')}
          </div>
          <div className="text-center text-gray-600 text-sm mt-2 mb-4 font-light dark:text-dark">
            {t('pages.timeline.stats', {
              categories: props.authorCardProps.catelogNum,
              posts: props.authorCardProps.postNum,
              tags: props.authorCardProps.tagNum,
              words: wordTotal,
            })}
          </div>
        </div>
        <div className="flex flex-col mt-2">
          {Object.keys(sortedArticles)
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map((key: string) => {
              return (
                <TimeLineItem
                  key={`timeline-dateitem-${key}`}
                  date={key}
                  articles={sortedArticles[key]}
                  defaultOpen={true}
                  openArticleLinksInNewWindow={
                    props.layoutProps.openArticleLinksInNewWindow == 'true'
                  }
                />
              );
            })}
        </div>
      </div>
    </Layout>
  );
};

export default TimeLine;
export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getTimeLinePageProps()),
      ...(await serverSideTranslations(locale)),
    },
    ...revalidate,
  };
}
