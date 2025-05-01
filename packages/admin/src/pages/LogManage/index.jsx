import React from 'react';
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import Login from './tabs/Login.jsx';
import Pipeline from './tabs/Pipeline.jsx';
import System from './tabs/System.tsx';

export default () => {
  return (
    <PageContainer title={t('log.page.title')}>
      {' '}
      {/* TODO */}
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab={t('log.tabs.login')} key="1">
          <Login />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('log.tabs.pipeline')} key="2">
          <Pipeline />
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('log.tabs.system')} key="3">
          <System />
        </Tabs.TabPane>
      </Tabs>
    </PageContainer>
  );
};
