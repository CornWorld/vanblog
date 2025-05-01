import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from '@ant-design/pro-layout';
import { Image, Space, Spin, Tag } from 'antd';
import { useMemo } from 'react';
import { useModel } from '@/router';

interface InitialState {
  version?: string;
}

export default function () {
  const { t } = useTranslation();
  const { initialState } = useModel() as { initialState: InitialState | undefined };

  const version = useMemo(() => {
    return initialState?.version || 'Unknown';
  }, [initialState]);

  if (!initialState) {
    return (
      <PageContainer title={t('about.title')} ghost>
        <Spin spinning={true} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={t('about.title')} ghost>
      <div style={{ marginTop: 32 }}>
        <Space direction="vertical" size={24}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <a href="https://vanblog.mereith.com/" rel="noopener noreferrer" target={'_blank'}>
                <Image width={64} src="/logo.svg" preview={false}></Image>
              </a>
            </div>
            <p>{t('about.system_name')}</p>
            <p>
              {t('about.version')}
              {version}
            </p>
            <p style={{ textAlign: 'left' }}>
              {t('about.description')}
              <Tag color="#87d068">Docker</Tag>
              <Tag color="#108ee9">TypeScript</Tag>
              <Tag color="#2db7f5">Markdown</Tag>
              {t('about.deployment_method')}
            </p>
          </div>
        </Space>
      </div>
    </PageContainer>
  );
}
