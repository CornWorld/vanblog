import { createArticle, createDraft } from '@/services/van-blog/api';
import { parseMarkdownFile } from '@/services/van-blog/parseMarkdownFile';
import { Alert, Button, Card, message, Space, Spin, Upload } from 'antd';
import { useState } from 'react';

const trans_zh = {
  'migrate.batch.article': '批量导入文章',
  'migrate.batch.draft': '批量导入草稿',
  'migrate.message.complete': '批量上传完成！',
  'migrate.card.title': '迁移助手',
  'migrate.alert.message':
    '注意：使用迁移助手批量导入文章或草稿时，可能分类会为空，后期需要手动修改哦',
};

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
          message.success(trans_zh['migrate.message.complete']);
        }
        return false;
      }}
    >
      <Button type="primary">
        {props.type == 'article'
          ? trans_zh['migrate.batch.article']
          : trans_zh['migrate.batch.draft']}
      </Button>
    </Upload>
  );
};

export default function MigrateTab() {
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
      <Card title={trans_zh['migrate.card.title']}>
        <Alert
          type="info"
          message={trans_zh['migrate.alert.message']}
          style={{ marginBottom: 20 }}
        />
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
