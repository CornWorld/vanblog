import React from 'react';
import { useTranslation } from 'react-i18next';
import { exportAll } from '@/services/van-blog/api';
import { Alert, Button, Card, message, Modal, Space, Spin, Upload } from 'antd';
import dayjs from '@/utils/dayjs';
import { useState } from 'react';

export default function () {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const handleOutPut = async () => {
    setLoading(true);
    const data = await exportAll();
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t('backup.download.prefix')}${dayjs().format('YYYY-MM-DD')}.json`;
    link.click();
    setLoading(false);
  };
  return (
    <Card title={t('backup.card.title')}>
      <Alert type="warning" message={t('backup.alert.message')} style={{ marginBottom: 20 }} />
      <Spin spinning={loading}>
        <Space size="large">
          <Upload
            showUploadList={false}
            name="file"
            accept=".json"
            action="/api/admin/backup/import"
            headers={{
              token: (() => {
                return window.localStorage.getItem('token') || 'null';
              })(),
            }}
            onChange={(info) => {
              setLoading(true);
              if (info.file.status !== 'uploading') {
                // console.log(info.file, info.fileList);
              }
              if (info.file.status === 'done') {
                if (location.hostname == 'blog-demo.mereith.com') {
                  Modal.info({
                    title: t('backup.modal.demo.title'),
                    content: t('backup.modal.demo.content'),
                  });
                  return;
                }
                message.success(`${info.file.name}${t('backup.message.upload.success')}`);
                setLoading(false);
              } else if (info.file.status === 'error') {
                message.error(`${info.file.name}${t('backup.message.upload.error')}`);
                setLoading(false);
              }
            }}
          >
            <Button>{t('backup.button.import')}</Button>
          </Upload>
          <Button type="primary" onClick={handleOutPut}>
            {t('backup.button.export')}
          </Button>
        </Space>
      </Spin>
    </Card>
  );
}
