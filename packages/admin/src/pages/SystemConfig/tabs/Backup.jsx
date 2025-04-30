import { exportAll } from '@/services/van-blog/api';
import { Alert, Button, Card, message, Modal, Space, Spin, Upload } from 'antd';
import dayjs from '@/utils/dayjs';
import { useState } from 'react';

const trans_zh = {
  'backup.card.title': '备份与恢复',
  'backup.alert.message':
    '注意：导入导出并不会实际导出图床中的图片本身，而是导入导出其图片记录以便检索。需要备份本地图床图片的话，可以在图床设置中点击导出全部本地图床内容哦！',
  'backup.button.import': '导入全部数据',
  'backup.button.export': '导出全部数据',
  'backup.download.prefix': '备份-',
  'backup.modal.demo.title': '演示站禁止修改此项！',
  'backup.modal.demo.content': '因为有个人在演示站首页放黄色信息，所以关了这个权限了。',
  'backup.message.upload.success': ' 上传成功! 稍后刷新就生效了!',
  'backup.message.upload.error': ' 上传失败!',
};

export default function () {
  const [loading, setLoading] = useState(false);
  const handleOutPut = async () => {
    setLoading(true);
    const data = await exportAll();
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trans_zh['backup.download.prefix']}${dayjs().format('YYYY-MM-DD')}.json`;
    link.click();
    setLoading(false);
  };
  return (
    <Card title={trans_zh['backup.card.title']}>
      <Alert
        type="warning"
        message={trans_zh['backup.alert.message']}
        style={{ marginBottom: 20 }}
      />
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
                    title: trans_zh['backup.modal.demo.title'],
                    content: trans_zh['backup.modal.demo.content'],
                  });
                  return;
                }
                message.success(`${info.file.name}${trans_zh['backup.message.upload.success']}`);
                setLoading(false);
              } else if (info.file.status === 'error') {
                message.error(`${info.file.name}${trans_zh['backup.message.upload.error']}`);
                setLoading(false);
              }
            }}
          >
            <Button>{trans_zh['backup.button.import']}</Button>
          </Upload>
          <Button type="primary" onClick={handleOutPut}>
            {trans_zh['backup.button.export']}
          </Button>
        </Space>
      </Spin>
    </Card>
  );
}
