import React from 'react';
import { useTranslation } from 'react-i18next';
import StaticForm from '@/components/StaticForm';
import WatchMarkForm from '@/components/WaterMarkForm';
import { exportAllImgs, scanImgsOfArticles } from '@/services/van-blog/api';
import { Alert, Button, Card, message, Modal, Table, Typography } from 'antd';
import { useState } from 'react';

export default function () {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  return (
    <>
      <Card title={t('img.card.settings.title')}>
        <WatchMarkForm />
      </Card>
      <Card title={t('img.card.storage.title')} style={{ marginTop: 8 }}>
        <StaticForm />
      </Card>
      <Card title={t('img.card.advanced.title')} style={{ marginTop: 8 }}>
        <Button
          style={{ margin: '20px 0' }}
          onClick={async () => {
            setLoading(true);
            try {
              const { data } = await scanImgsOfArticles();
              message.success(t('img.message.scan.success', { total: data?.total || 0 }));
              setLoading(false);
              const { errorLinks } = data;
              if (errorLinks && errorLinks.length) {
                Modal.info({
                  title: t('img.modal.dead_links.title'),
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
                          title: t('img.column.article_id'),
                          dataIndex: 'artcileId',
                          key: 'artcileId',
                        },
                        { title: t('img.column.title'), dataIndex: 'title', key: 'title' },
                        {
                          title: t('img.column.link'),
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
              message.error(t('img.message.scan.failed'));
              setLoading(false);
            }
          }}
          type="primary"
          loading={loading}
        >
          {t('img.button.scan')}
        </Button>
        <Alert type="info" message={t('img.alert.scan')}></Alert>
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
              message.error(t('img.message.export.failed'));
              setExporting(false);
            }
          }}
        >
          {t('img.button.export')}
        </Button>
        <Alert type="info" message={t('img.alert.export')}></Alert>
      </Card>
    </>
  );
}
