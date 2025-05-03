import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import '../Welcome/index.less';
import Advance from './tabs/Advance';
import Backup from './tabs/Backup';
import Caddy from './tabs/Caddy';
import Customizing from './tabs/Customizing';
import ImgTab from './tabs/ImgTab';
import Migrate from './tabs/migrate';
import SiteInfo from './tabs/SiteInfo';
import User from './tabs/User';
import WalineTab from './tabs/WalineTab';
import Token from './tabs/Token';

export default function () {
  const { t } = useTranslation();
  const tabMap = {
    siteInfo: <SiteInfo />,
    customizing: <Customizing />,
    backup: <Backup />,
    user: <User />,
    img: <ImgTab />,
    waline: <WalineTab />,
    caddy: <Caddy />,
    advance: <Advance />,
    migrate: <Migrate />,
    token: <Token />,
  };
  const [tab, setTab] = useTab('siteInfo', 'tab');

  return (
    <PageContainer
      title={null}
      extra={null}
      header={{ title: null, extra: null, ghost: true }}
      className="thinheader"
      tabActiveKey={tab}
      tabList={[
        {
          tab: t('system.tabs.site_info'),
          key: 'siteInfo',
        },
        {
          tab: t('system.tabs.customizing'),
          key: 'customizing',
        },
        {
          tab: t('system.tabs.user'),
          key: 'user',
        },
        {
          tab: t('system.tabs.img'),
          key: 'img',
        },
        {
          tab: t('system.tabs.waline'),
          key: 'waline',
        },
        {
          tab: t('system.tabs.backup'),
          key: 'backup',
        },
        {
          tab: t('system.tabs.token'),
          key: 'token',
        },
        {
          tab: t('system.tabs.caddy'),
          key: 'caddy',
        },
        {
          tab: t('system.tabs.advance'),
          key: 'advance',
        },
        {
          tab: t('system.tabs.migrate'),
          key: 'migrate',
        },
      ]}
      onTabChange={setTab}
    >
      {tabMap[tab]}
    </PageContainer>
  );
}
