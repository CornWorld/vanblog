import SiteInfoForm from '@/components/SiteInfoForm';
import { getSiteInfo, updateSiteInfo } from '@/services/van-blog/api';
import { useTab } from '@/services/van-blog/useTab';
import { ProForm } from '@ant-design/pro-components';
import { Card, message, Modal } from 'antd';

const trans_zh = {
  'site_info.tab.basic': '基本设置',
  'site_info.tab.more': '高级设置',
  'site_info.tab.layout': '布局设置',
  'site_info.modal.url_invalid.title': '网站 URL 不合法！',
  'site_info.modal.url_invalid.content1': '请输入包含完整协议的 URL',
  'site_info.modal.url_invalid.content2': '例: https://blog-demo.mereith.com',
  'site_info.modal.demo': '演示站禁止修改站点配置！',
  'site_info.message.update_success': '更新成功！',
};

export default function () {
  const [tab, setTab] = useTab('basic', 'siteInfoTab');
  const [form] = ProForm.useForm();
  const tabList = [
    {
      key: 'basic',
      tab: trans_zh['site_info.tab.basic'],
    },
    {
      key: 'more',
      tab: trans_zh['site_info.tab.more'],
    },
    {
      key: 'layout',
      tab: trans_zh['site_info.tab.layout'],
    },
  ];

  return (
    <Card tabList={tabList} onTabChange={setTab} activeTabKey={tab}>
      <ProForm
        form={form}
        grid={true}
        layout={'horizontal'}
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        rowProps={{ gutter: [16, 0] }}
        request={async () => {
          try {
            const { data } = await getSiteInfo();
            return data;
          } catch (error) {
            console.error('Failed to get site info:', error);
            message.error('Failed to load site information');
            return {};
          }
        }}
        syncToInitialValues={true}
        onFinish={async (data) => {
          let ok = true;
          try {
            new URL(data.baseUrl);
          } catch (error) {
            console.error('Invalid base URL:', error);
            ok = false;
          }
          if (!data.baseUrl) {
            ok = true;
          }
          if (!ok) {
            Modal.warn({
              title: trans_zh['site_info.modal.url_invalid.title'],
              content: (
                <div>
                  <p>{trans_zh['site_info.modal.url_invalid.content1']}</p>
                  <p>{trans_zh['site_info.modal.url_invalid.content2']}</p>
                </div>
              ),
            });
            return;
          }
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: trans_zh['site_info.modal.demo'] });
            return;
          }
          try {
            await updateSiteInfo(data);
            message.success(trans_zh['site_info.message.update_success']);
          } catch (error) {
            console.error('Failed to update site info:', error);
            message.error('Failed to update site information');
          }
        }}
      >
        <SiteInfoForm
          form={form}
          showLayout={tab == 'layout'}
          showOption={tab == 'more'}
          showRequire={tab == 'basic'}
          isInit={false}
        />
      </ProForm>
    </Card>
  );
}
