import { PageContainer } from '@ant-design/pro-components';
import { Tabs } from 'antd';
import Login from './tabs/Login.jsx';
import Pipeline from './tabs/Pipeline.jsx';
import System from './tabs/System.tsx';

const trans_zh = {
  'log.tabs.login': '登录',
  'log.tabs.pipeline': '流水线',
  'log.tabs.system': '系统',
  'log.page.title': '日志管理',
};

export default () => {
  return (
    <PageContainer title={trans_zh['log.page.title']}>
      {' '}
      {/* TODO */}
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab={trans_zh['log.tabs.login']} key="1">
          <Login />
        </Tabs.TabPane>
        <Tabs.TabPane tab={trans_zh['log.tabs.pipeline']} key="2">
          <Pipeline />
        </Tabs.TabPane>
        <Tabs.TabPane tab={trans_zh['log.tabs.system']} key="3">
          <System />
        </Tabs.TabPane>
      </Tabs>
    </PageContainer>
  );
};
