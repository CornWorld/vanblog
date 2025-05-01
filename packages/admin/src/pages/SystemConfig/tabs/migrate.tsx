import React from 'react';
import { useTranslation } from 'react-i18next';
import { createArticle, createDraft } from '@/services/van-blog/api';
import { parseMarkdownFile } from '@/services/van-blog/parseMarkdownFile';
import { Alert, Button, Card, message, Space, Spin, Upload } from 'antd';
import { useState } from 'react';

interface BatchImportProps {
  type: 'article' | 'draft';
  beforeUpload: (type: 'article' | 'draft', file: File) => Promise<void>;
}

const BatchImport = (props: BatchImportProps) => {
  return (
    <Upload
      showUploadList={false}
      accept=".md"
      multiple={true}
      beforeUpload={async (file, files) => {
        await props.beforeUpload(props.type, file);
        if (files[files.length - 1] == file) {
          message.success(t('migrate.message.complete'));
        }
        return false;
      }}
    >
      <Button type="primary">
        {props.type == 'article' ? t('migrate.batch.article') : t('migrate.batch.draft')}
      </Button>
    </Upload>
  );
};

export default function MigrateTab() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const handleImport = async (type: 'article' | 'draft', file: File) => {
    setLoading(true);
    try {
      const vals = await parseMarkdownFile(file);
      if (vals) {
        if (type == 'article') {
          await createArticle(vals);
        } else {
          await createDraft(vals);
        }
      }
    } catch (error) {
      console.error('Error importing file:', error);
      message.error('导入失败，请检查文件格式');
    }
    setLoading(false);
  };

  return (
    <>
      <Card title={t('migrate.card.title')}>
        <Alert type="info" message={t('migrate.alert.message')} style={{ marginBottom: 20 }} />
        <Spin spinning={loading}>
          <Space size="large">
            <BatchImport type="article" beforeUpload={handleImport} />
            <BatchImport type="draft" beforeUpload={handleImport} />
            {/* <Upload showUploadList={false} accept=".md" multiple={true} beforeUpload={}>
              <Button>批量导入草稿</Button>
            </Upload> */}
          </Space>
        </Spin>
      </Card>
    </>
  );
}
