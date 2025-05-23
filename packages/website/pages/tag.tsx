import Link from 'next/link';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import { encodeQuerystring } from '../utils/encode';
import { LayoutProps } from '../utils/getLayoutProps';
import { getTagPageProps } from '../utils/getPageProps';
import { revalidate } from '../utils/loadConfig';
import { PageViewData } from '../api/pageView';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

const getTarget = (newTab: boolean) => {
  return newTab ? '_blank' : '_self';
};

export interface TagPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  tags: string[];
  pageViewData: PageViewData;
}

const TagPage = (props: TagPageProps) => {
  const { t } = useTranslation();

  return (
    <Layout
      option={props.layoutProps}
      title={t('pages.tags.title')}
      sideBar={<AuthorCard option={props.authorCardProps}></AuthorCard>}
    >
      <div className="bg-white card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div className="text-lg md:text-xl text-gray-700 dark:text-dark">
          {t('pages.tags.title')}
        </div>
        <div className="flex flex-wrap mt-2">
          {props.tags.map((tag) => (
            <Link
              href={`/tag/${encodeQuerystring(tag)}`}
              key={`tag-${tag}`}
              target={getTarget(props.layoutProps.openArticleLinksInNewWindow == 'true')}
            >
              <div className="my-2 text-gray-500 block hover:text-gray-900 dark:hover:text-dark-hover transform hover:scale-110 transition-all mr-5 dark:text-dark-400 ">{`${tag}`}</div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default TagPage;
export async function getStaticProps({ locale }) {
  const result = {
    props: {
      ...(await getTagPageProps()),
      ...(await serverSideTranslations(locale)),
    },
    ...revalidate,
  };
  return result;
}
