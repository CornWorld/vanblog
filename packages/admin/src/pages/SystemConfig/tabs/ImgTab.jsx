import StaticForm from '@/components/StaticForm';
import WatchMarkForm from '@/components/WaterMarkForm';
import { exportAllImgs, scanImgsOfArticles } from '@/services/van-blog/api';
import { Alert, Button, Card, message, Modal, Table, Typography } from 'antd';
import { useState } from 'react';

const trans_zh = {
  'img.card.settings.title': '图床功能设置',
  'img.card.storage.title': '存储策略设置',
  'img.card.advanced.title': '高级操作',
  'img.button.scan': '扫描现有文章图片到图床',
  'img.button.export': '导出全部本地图床内容（压缩包）',
  'img.alert.scan':
    'PS: 扫描文章图片会把文章内的所有图片扫描到数据库中，就可以在图床页面看到了。只支持外链。',
  'img.alert.export':
    'PS: 导出全部图片会把本地图床的全部文件打包成一个 zip 压缩包并在完成后弹出下载窗口。',
  'img.message.scan.success': '扫描成功！共 {total} 项',
  'img.message.scan.failed': '扫描失败，请稍后重试',
  'img.message.export.failed': '导出失败，请稍后重试',
  'img.modal.dead_links.title': '失效链接：',
  'img.column.article_id': '文章 ID',
  'img.column.title': '标题',
  'img.column.link': '链接',
};

export default function () {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  return (
    <>
      <Card title={trans_zh['img.card.settings.title']}>
        <WatchMarkForm />
      </Card>
      <Card title={trans_zh['img.card.storage.title']} style={{ marginTop: 8 }}>
        <StaticForm />
      </Card>
      <Card title={trans_zh['img.card.advanced.title']} style={{ marginTop: 8 }}>
        <Button
          style={{ margin: '20px 0' }}
          onClick={async () => {
            setLoading(true);
            try {
              const { data } = await scanImgsOfArticles();
              message.success(
                trans_zh['img.message.scan.success'].replace('{total}', data?.total || 0),
              );
              setLoading(false);
              const { errorLinks } = data;
              if (errorLinks && errorLinks.length) {
                Modal.info({
                  title: trans_zh['img.modal.dead_links.title'],
                  content: (
                    <Table
                      pagination={{
                        hideOnSinglePage: true,
                      }}
                      rowKey={'link'}
                      dataSource={errorLinks}
                      size="small"
                      columns={[
                        {
                          title: trans_zh['img.column.article_id'],
                          dataIndex: 'artcileId',
                          key: 'artcileId',
                        },
                        { title: trans_zh['img.column.title'], dataIndex: 'title', key: 'title' },
                        {
                          title: trans_zh['img.column.link'],
                          dataIndex: 'link',
                          key: 'link',
                          render: (val) => {
                            return (
                              <Typography.Text
                                copyable={val.length > 20}
                                style={{
                                  wordBreak: 'break-all',
                                  wordWrap: 'break-word',
                                }}
                              >
                                {val}
                              </Typography.Text>
                            );
                          },
                        },
                      ]}
                    />
                  ),
                });
              }
            } catch (error) {
              console.error('Failed to scan images:', error);
              message.error(trans_zh['img.message.scan.failed']);
              setLoading(false);
            }
          }}
          type="primary"
          loading={loading}
        >
          {trans_zh['img.button.scan']}
        </Button>
        <Alert type="info" message={trans_zh['img.alert.scan']}></Alert>
        <Button
          style={{ margin: '20px 0' }}
          loading={exporting}
          type="primary"
          onClick={async () => {
            setExporting(true);
            try {
              const { data } = await exportAllImgs();
              const link = document.createElement('a');
              link.href = data;
              link.download = data.split('/').pop();
              link.click();
              setExporting(false);
            } catch (error) {
              console.error('Failed to export images:', error);
              message.error(trans_zh['img.message.export.failed']);
              setExporting(false);
            }
          }}
        >
          {trans_zh['img.button.export']}
        </Button>
        <Alert type="info" message={trans_zh['img.alert.export']}></Alert>
      </Card>
    </>
  );
}
