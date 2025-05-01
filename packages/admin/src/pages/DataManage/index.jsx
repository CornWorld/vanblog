import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import '../Welcome/index.less';
import Category from './tabs/Category';
import Donate from './tabs/Donate';
import Link from './tabs/Link';
import Menu from './tabs/Menu';
import Social from './tabs/Social';
import Tag from './tabs/Tag';

export default function () {
  const { t } = useTranslation();
  const tabMap = {
    category: <Category />,
    tag: <Tag />,
    donateInfo: <Donate />,
    links: <Link />,
    socials: <Social />,
    menuConfig: <Menu />,
  };
  const [tab, setTab] = useTab('category', 'tab');

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className="thinheader"
      tabActiveKey={tab}
      tabList={[
        {
          tab: t('data.tabs.category'),
          key: 'category',
        },
        {
          tab: t('data.tabs.tag'),
          key: 'tag',
        },
        {
          tab: t('data.tabs.menu'),
          key: 'menuConfig',
        },
        {
          tab: t('data.tabs.donate'),
          key: 'donateInfo',
        },
        {
          tab: t('data.tabs.link'),
          key: 'links',
        },
        {
          tab: t('data.tabs.social'),
          key: 'socials',
        },
      ]}
      onTabChange={setTab}
    >
      {tabMap[tab]}
    </PageContainer>
  );
}
