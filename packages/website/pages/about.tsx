import dayjs from 'dayjs';
import { useMemo } from 'react';
import { DonateItem } from '../api/getAllData';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import PostCard from '../components/PostCard';
import { LayoutProps } from '../utils/getLayoutProps';
import { getAboutPageProps } from '../utils/getPageProps';
import { revalidate } from '../utils/loadConfig';
import { PageViewData } from '../api/pageView';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

export interface About {
  updatedAt: string;
  content: string;
}
export interface AboutPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  donates: DonateItem[];
  about: About;
  pay: string[];
  payDark: string[];
  showDonateInfo: 'true' | 'false';
  showDonateInAbout: 'true' | 'false';
  pageViewData: PageViewData;
}
const getDonateTableMarkdown = (donates: DonateItem[], t) => {
  let content = `
## ${t('donate.info')}

| ${t('donate.name')} | ${t('donate.amount')}|${t('donate.time')}|
|---|---|---|
  `;
  for (const each of donates) {
    content =
      content +
      `|${each.name}|${each.value} ${t('donate.unit')}|${dayjs(each.updatedAt).format(
        'YYYY-MM-DD HH:mm:ss',
      )}|\n`;
  }
  return content;
};
const AboutPage = (props: AboutPageProps) => {
  const { t } = useTranslation();

  const content = useMemo(() => {
    if (props.donates.length == 0 || props.showDonateInfo == 'false') {
      return props.about.content;
    } else {
      return `${props.about.content}${getDonateTableMarkdown(props.donates, t)}`;
    }
  }, [props, t]);

  return (
    <Layout
      title={t('pages.about.title')}
      option={props.layoutProps}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <PostCard
        setContent={() => {}}
        showExpirationReminder={props.layoutProps.showExpirationReminder == 'true'}
        openArticleLinksInNewWindow={false}
        id={0}
        key={'about'}
        private={false}
        title={t('pages.about.title')}
        updatedAt={new Date(props.about.updatedAt)}
        createdAt={new Date(props.about.updatedAt)}
        pay={props.pay}
        payDark={props.payDark}
        catelog={'about'}
        content={content}
        type={'about'}
        enableComment={props.layoutProps.enableComment}
        top={0}
        customCopyRight={null}
        showDonateInAbout={props.showDonateInAbout == 'true'}
        copyrightAggreement={props.layoutProps.copyrightAggreement}
        showEditButton={props.layoutProps.showEditButton === 'true'}
      ></PostCard>
    </Layout>
  );
};

export default AboutPage;
export async function getStaticProps({ locale }) {
  const result = {
    props: {
      ...(await getAboutPageProps()),
      ...(await serverSideTranslations(locale)),
    },
    ...revalidate,
  };
  return result;
}
