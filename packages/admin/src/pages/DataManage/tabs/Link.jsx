import React from 'react';
import { useTranslation } from 'react-i18next';
import { deleteLink, getLink, updateLink } from '@/services/van-blog/api';
import { EditableProTable } from '@ant-design/pro-components';
import { Modal, Spin } from 'antd';
import { useRef, useState } from 'react';

export default function () {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [editableKeys, setEditableRowKeys] = useState([]);
  const actionRef = useRef();
  const fetchData = async () => {
    setLoading(true);
    const { data } = await getLink();
    setLoading(false);
    return data.map((item) => ({ key: item.name, ...item }));
  };
  const columns = [
    {
      title: t('link.column.name'),
      dataIndex: 'name',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('link.message.required') }],
        };
      },
    },
    {
      title: t('link.column.url'),
      dataIndex: 'url',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('link.message.required') }],
        };
      },
    },
    {
      title: t('link.column.desc'),
      dataIndex: 'desc',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('link.message.required') }],
        };
      },
    },
    {
      title: t('link.column.logo'),
      dataIndex: 'logo',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('link.message.required') }],
        };
      },
    },
    {
      title: t('link.column.updatedAt'),
      valueType: 'date',
      editable: false,
      dataIndex: 'updatedAt',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('link.message.required') }],
        };
      },
    },
    {
      title: t('link.column.actions'),
      valueType: 'option',
      key: 'option',
      width: 200,
      render: (text, record, _, action) => [
        <a
          key="editable"
          onClick={() => {
            action?.startEditable?.(record.name);
          }}
        >
          {t('link.action.edit')}
        </a>,
        <a
          key="delete"
          onClick={async () => {
            Modal.confirm({
              onOk: async () => {
                await deleteLink(record.name);
                action?.reload();
              },
              title: t('link.modal.deleteConfirm', { name: record.name }),
            });
          }}
        >
          {t('link.action.delete')}
        </a>,
      ],
    },
  ];
  return (
    <>
      <Spin spinning={loading}>
        <EditableProTable
          rowKey="key"
          headerTitle={t('link.table.header')}
          actionRef={actionRef}
          scroll={{
            x: 960,
          }}
          recordCreatorProps={{
            position: 'bottom',
            record: () => ({ key: Date.now() }),
          }}
          loading={false}
          columns={columns}
          request={async () => {
            let data = await fetchData();

            return {
              data,
              success: true,
            };
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onSave: async (rowKey, data) => {
              if (location.hostname == 'blog-demo.mereith.com') {
                Modal.info({ title: t('link.modal.demoRestriction') });
                return;
              }
              const toSaveObj = {
                name: data.name,
                url: data.url,
                logo: data.logo,
                desc: data.desc,
              };
              await updateLink(toSaveObj);
              actionRef?.current?.reload();
            },
            onChange: setEditableRowKeys,
          }}
        />
      </Spin>
    </>
  );
}
