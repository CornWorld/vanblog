import React from 'react';
import { useTranslation } from 'react-i18next';
import CustomPageModal from '@/components/CustomPageModal';
import { deleteCustomPageByPath, getCustomPages } from '@/services/van-blog/api';
import { ProTable } from '@ant-design/pro-components';
import { Button, Card, message, Modal, Space } from 'antd';
import { useRef } from 'react';
import { Link } from '@/router';

export default function () {
  const { t } = useTranslation();
  // const [loading, setLoading] = useState(true);
  const actionRef = useRef();

  const columns = [
    {
      title: t('custompage.column.index'),
      render: (_, record, index) => {
        return index;
      },
    },
    { dataIndex: 'name', title: t('custompage.column.name') },
    {
      dataIndex: 'type',
      title: t('custompage.column.type'),
      valueType: 'select',
      valueEnum: {
        file: {
          text: t('custompage.column.type.file'),
          status: 'Default',
        },
        folder: {
          text: t('custompage.column.type.folder'),
          status: 'Success',
        },
      },
    },
    { dataIndex: 'path', title: t('custompage.column.path') },
    {
      title: t('custompage.column.actions'),
      render: (_, record) => {
        return (
          <Link
            to={
              record.type == 'file'
                ? `/code?type=file&lang=html&path=${record.path}`
                : `/code?type=folder&path=${record.path}`
            }
          >
            {record.type == 'file'
              ? t('custompage.action.edit_content')
              : t('custompage.action.file_manage')}
          </Link>
        );
      },
    },
    {
      title: t('custompage.column.path'),
      render: (_, record, __, action) => {
        return (
          <Space>
            <a key="view" target="_blank" rel="noreferrer" href={`/c${record.path}`}>
              {t('custompage.action.view')}
            </a>

            <CustomPageModal
              key={'editInfo'}
              trigger={<a>{t('custompage.action.edit_info')}</a>}
              initialValues={record}
              onFinish={() => {
                action?.reload();
              }}
            ></CustomPageModal>
            <a
              key="delete"
              onClick={() => {
                if (location.hostname == 'blog-demo.mereith.com') {
                  Modal.info({
                    title: t('custompage.modal.demo.title'),
                  });
                  return;
                }
                Modal.confirm({
                  title: t('custompage.modal.delete.title'),
                  content: t('custompage.modal.delete.content'),
                  onOk: async () => {
                    await deleteCustomPageByPath(record.path);
                    action?.reload();
                    message.success(t('custompage.message.delete.success'));
                  },
                });
              }}
            >
              {t('custompage.action.delete')}
            </a>
          </Space>
        );
      },
    },
  ];

  const handleHelp = () => {
    Modal.info({
      title: t('custompage.modal.help.title'),
      content: (
        <div>
          <p>{t('custompage.modal.help.content1')}</p>
          <p>{t('custompage.modal.help.content2')}</p>
          <p>{t('custompage.modal.help.content3')}</p>
          <p>{t('custompage.modal.help.content4')}</p>
          <a
            target="_blank"
            href="https://vanblog.mereith.com/feature/advance/customPage.html"
            rel="noreferrer"
          >
            {t('custompage.modal.help.docs')}
          </a>
        </div>
      ),
    });
  };

  return (
    <>
      <Card
        className="card-body-full"
        title={t('custompage.title')}
        extra={
          <Space>
            <CustomPageModal
              trigger={<Button type="primary">{t('custompage.button.new')}</Button>}
              onFinish={() => {
                actionRef.current?.reload();
                message.success(t('custompage.message.new.success'));
              }}
            />
            <Button type="link" key="help" onClick={handleHelp}>
              {t('custompage.button.help')}
            </Button>
          </Space>
        }
      >
        <ProTable
          rowKey="_id"
          columns={columns}
          dateFormatter="string"
          actionRef={actionRef}
          search={false}
          options={false}
          pagination={{
            hideOnSinglePage: true,
            simple: true,
          }}
          request={async () => {
            let { data } = await getCustomPages();
            return {
              data,
              // success 请返回 true，
              // 不然 table 会停止解析数据，即使有数据
              success: true,
              // 不传会使用 data 的长度，如果是分页一定要传
              total: data.length,
            };
          }}
        />
      </Card>
    </>
  );
}
