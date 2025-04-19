import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import TimeLineItem from '../components/TimeLineItem';
import { Article } from '../types/article';
import { LayoutProps } from '../utils/getLayoutProps';
import { getCategoryPageProps } from '../utils/getPageProps';
import { revalidate } from '../utils/loadConfig';
import { PageViewData } from '../api/pageView';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

export interface CategoryPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  categories: string[];
  articles: Article[];
  pageViewData: PageViewData;
}
const CategoryPage = (props: CategoryPageProps) => {
  const { t } = useTranslation();
  // Calculate total word count
  const wordTotal = props.articles.reduce((total, article) => {
    return total + (article.wordCount || 0);
  }, 0);

  return (
    <Layout
      option={props.layoutProps}
      title={t('pages.category.title')}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div>
          <div className="text-2xl md:text-3xl text-gray-700 text-center dark:text-dark">
            {t('pages.category.title')}
          </div>
          <div className="text-center text-gray-600 text-sm mt-2 mb-4 font-light dark:text-dark">
            {t('pages.category.stats', {
              categories: props.authorCardProps.catelogNum,
              posts: props.authorCardProps.postNum,
              tags: props.authorCardProps.tagNum,
              words: wordTotal,
            })}
          </div>
        </div>
        <div className="flex flex-col mt-2">
          {props.categories.map((category: string) => {
            return (
              <TimeLineItem
                openArticleLinksInNewWindow={
                  props.layoutProps.openArticleLinksInNewWindow == 'true'
                }
                defaultOpen={false}
                key={category}
                date={category}
                articles={props.articles.filter(
                  (article: Article) => article.category === category,
                )}
                showYear={true}
              ></TimeLineItem>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default CategoryPage;
export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getCategoryPageProps()),
      ...(await serverSideTranslations(locale, ['translations'])),
    },
    ...revalidate,
  };
}
