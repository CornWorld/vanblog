import { PageContainer } from '@ant-design/pro-layout';
import { Image, Space, Spin, Tag } from 'antd';
import { useMemo } from 'react';
import { useModel } from '@/utils/umiCompat';

const trans_zh = {
  'about.title': '关于',
  'about.system_name': 'VanBlog 博客系统',
  'about.version': '版本: ',
  'about.description': '此项目是 VanBlog 的 Fork 版本，提供更多的功能和优化，并支持',
  'about.deployment_method': '部署方式。',
};

interface InitialState {
  version?: string;
}

export default function () {
  const { initialState } = useModel() as { initialState: InitialState | undefined };

  const version = useMemo(() => {
    return initialState?.version || 'Unknown';
  }, [initialState]);

  if (!initialState) {
    return (
      <PageContainer title={trans_zh['about.title']} ghost>
        <Spin spinning={true} />
      </PageContainer>
    );
  }

  return (
    <PageContainer title={trans_zh['about.title']} ghost>
      <div style={{ marginTop: 32 }}>
        <Space direction="vertical" size={24}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <a href="https://vanblog.mereith.com/" rel="noopener noreferrer" target={'_blank'}>
                <Image width={64} src="/logo.svg" preview={false}></Image>
              </a>
            </div>
            <p>{trans_zh['about.system_name']}</p>
            <p>
              {trans_zh['about.version']}
              {version}
            </p>
            <p style={{ textAlign: 'left' }}>
              {trans_zh['about.description']}
              <Tag color="#87d068">Docker</Tag>
              <Tag color="#108ee9">TypeScript</Tag>
              <Tag color="#2db7f5">Markdown</Tag>
              {trans_zh['about.deployment_method']}
            </p>
          </div>
        </Space>
      </div>
    </PageContainer>
  );
}
