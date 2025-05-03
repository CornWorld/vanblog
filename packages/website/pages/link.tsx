import { useState, useEffect, useMemo } from 'react';
import { LinkItem } from '../api/getAllData';
import AuthorCard, { AuthorCardProps } from '../components/AuthorCard';
import Layout from '../components/Layout';
import LinkCard from '../components/LinkCard';
import Markdown from '../components/Markdown';
import WaLine from '../components/WaLine';
import { LayoutProps } from '../utils/getLayoutProps';
import { getLinkPageProps } from '../utils/getPageProps';
import { revalidate } from '../utils/loadConfig';
import { PageViewData } from '../api/pageView';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

export interface LinkPageProps {
  layoutProps: LayoutProps;
  authorCardProps: AuthorCardProps;
  links: LinkItem[];
  pageViewData: PageViewData;
}

const LinkPage = (props: LinkPageProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(window.location.origin);
  }, [setUrl]);
  const logo = useMemo(() => {
    let logo = props.layoutProps.logo;
    if (props.layoutProps.logo == '') {
      logo = props.authorCardProps.logo || '';
    }
    if (logo == '') {
      logo = `${url}/logo.svg`;
    }
    return logo;
  }, [props, url]);
  const requireContent = `
**[${t('pages.link.requirements.title')}]**
- [x] ${t('pages.link.requirements.items.0')}
- [x] ${t('pages.link.requirements.items.1')}
- [x] ${t('pages.link.requirements.items.2')}
- [x] ${t('pages.link.requirements.items.3')}
- [x] ${t('pages.link.requirements.items.4')}

**[${t('pages.link.siteInfo.title')}]**
> ${t('pages.link.siteInfo.name')}： ${props.layoutProps.siteName}<br/>
> ${t('pages.link.siteInfo.description')}： ${props.layoutProps.description}<br/>
> ${t('pages.link.siteInfo.url')}： [${url}](${url})<br/>
> ${t('pages.link.siteInfo.avatar')}： [${logo}](${logo})
`;
  return (
    <Layout
      option={props.layoutProps}
      title={t('pages.link.title')}
      sideBar={<AuthorCard option={props.authorCardProps} />}
    >
      <div className="bg-white dark:text-dark card-shadow dark:bg-dark dark:card-shadow-dark py-4 px-8 md:py-6 md:px-8">
        <div>
          <div className="text-2xl md:text-3xl text-gray-700 dark:text-dark text-center">
            {t('pages.link.title')}
          </div>
        </div>
        <div className="flex flex-col mt-6 mb-2">
          <p className="mb-6 ">{t('pages.link.description')}</p>
          <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {props.links.map((link) => (
              <LinkCard link={link} key={`${link.url}${link.name}`} />
            ))}
          </div>
          <hr className="mt-8 dark:border-hr-dark" />
          <div className="mt-4 text-sm md:text-base ">
            <Markdown content={requireContent} />
          </div>
          <div>
            <blockquote>
              <p></p>
            </blockquote>
          </div>
        </div>
      </div>
      <WaLine enable={props.layoutProps.enableComment} visible={true} />
    </Layout>
  );
};

export default LinkPage;
export async function getStaticProps({ locale }) {
  const result = {
    props: {
      ...(await getLinkPageProps()),
      ...(await serverSideTranslations(locale)),
    },
    ...revalidate,
  };
  return result;
}
