import React from 'react';
import { useTranslation } from 'react-i18next';
import SiteInfoForm from '@/components/SiteInfoForm';
import { getSiteInfo, updateSiteInfo } from '@/services/van-blog/api';
import { useTab } from '@/services/van-blog/useTab';
import { ProForm } from '@ant-design/pro-components';
import { Card, message, Modal } from 'antd';

export default function () {
  const { t } = useTranslation();
  const [tab, setTab] = useTab('basic', 'siteInfoTab');
  const [form] = ProForm.useForm();
  const tabList = [
    {
      key: 'basic',
      tab: t('site_info.tab.basic'),
    },
    {
      key: 'more',
      tab: t('site_info.tab.more'),
    },
    {
      key: 'layout',
      tab: t('site_info.tab.layout'),
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
              title: t('site_info.modal.url_invalid.title'),
              content: (
                <div>
                  <p>{t('site_info.modal.url_invalid.content1')}</p>
                  <p>{t('site_info.modal.url_invalid.content2')}</p>
                </div>
              ),
            });
            return;
          }
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: t('site_info.modal.demo') });
            return;
          }
          try {
            await updateSiteInfo(data);
            message.success(t('site_info.message.update_success'));
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
