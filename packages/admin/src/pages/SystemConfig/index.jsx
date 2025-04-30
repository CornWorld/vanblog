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

const trans_zh = {
  'system.tabs.site_info': '站点配置',
  'system.tabs.customizing': '客制化',
  'system.tabs.user': '用户设置',
  'system.tabs.img': '图床设置',
  'system.tabs.waline': '评论设置',
  'system.tabs.backup': '备份恢复',
  'system.tabs.token': 'Token 管理',
  'system.tabs.caddy': 'HTTPS',
  'system.tabs.advance': '高级设置',
  'system.tabs.migrate': '迁移助手',
};

export default function () {
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
          tab: trans_zh['system.tabs.site_info'],
          key: 'siteInfo',
        },
        {
          tab: trans_zh['system.tabs.customizing'],
          key: 'customizing',
        },
        {
          tab: trans_zh['system.tabs.user'],
          key: 'user',
        },
        {
          tab: trans_zh['system.tabs.img'],
          key: 'img',
        },
        {
          tab: trans_zh['system.tabs.waline'],
          key: 'waline',
        },
        {
          tab: trans_zh['system.tabs.backup'],
          key: 'backup',
        },
        {
          tab: trans_zh['system.tabs.token'],
          key: 'token',
        },
        {
          tab: trans_zh['system.tabs.caddy'],
          key: 'caddy',
        },
        {
          tab: trans_zh['system.tabs.advance'],
          key: 'advance',
        },
        {
          tab: trans_zh['system.tabs.migrate'],
          key: 'migrate',
        },
      ]}
      onTabChange={setTab}
    >
      {tabMap[tab]}
    </PageContainer>
  );
}
