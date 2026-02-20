import { useTranslation } from 'react-i18next';
import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import Login from './tabs/Login.jsx';
import Pipeline from './tabs/Pipeline.jsx';
import System from './tabs/System.tsx';

export default function LogManagePage() {
  const { t } = useTranslation();

  const items = [
    { key: '1', label: t('log.tabs.login'), children: <Login /> },
    { key: '2', label: t('log.tabs.pipeline'), children: <Pipeline /> },
    { key: '3', label: t('log.tabs.system'), children: <System /> },
  ];

  return (
    <PageContainer title={t('log.page.title')}>
      <Tabs defaultActiveKey="1" items={items} />
    </PageContainer>
  );
}
