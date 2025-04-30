import { useTab } from '@/services/van-blog/useTab';
import { PageContainer } from '@ant-design/pro-layout';
import '../Welcome/index.less';
import Category from './tabs/Category';
import Donate from './tabs/Donate';
import Link from './tabs/Link';
import Menu from './tabs/Menu';
import Social from './tabs/Social';
import Tag from './tabs/Tag';

const trans_zh = {
  'data.tabs.category': '分类管理',
  'data.tabs.tag': '标签管理',
  'data.tabs.menu': '导航配置',
  'data.tabs.donate': '捐赠管理',
  'data.tabs.link': '友情链接',
  'data.tabs.social': '联系方式',
};

export default function () {
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
          tab: trans_zh['data.tabs.category'],
          key: 'category',
        },
        {
          tab: trans_zh['data.tabs.tag'],
          key: 'tag',
        },
        {
          tab: trans_zh['data.tabs.menu'],
          key: 'menuConfig',
        },
        {
          tab: trans_zh['data.tabs.donate'],
          key: 'donateInfo',
        },
        {
          tab: trans_zh['data.tabs.link'],
          key: 'links',
        },
        {
          tab: trans_zh['data.tabs.social'],
          key: 'socials',
        },
      ]}
      onTabChange={setTab}
    >
      {tabMap[tab]}
    </PageContainer>
  );
}
