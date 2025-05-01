import React from 'react';
import { useTranslation } from 'react-i18next';
import { deleteSocial, getSocial, getSocialTypes, updateSocial } from '@/services/van-blog/api';
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
    const { data } = await getSocial();

    setLoading(false);
    return data.map((item) => ({ key: item.type, ...item }));
  };
  const columns = [
    {
      title: t('social.column.type'),
      dataIndex: 'type',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('social.message.required') }],
        };
      },
      request: async () => {
        const { data } = await getSocialTypes();
        return data || [];
      },
    },
    {
      title: t('social.column.value'),
      dataIndex: 'value',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('social.message.required') }],
        };
      },
    },
    {
      title: t('social.column.updatedAt'),
      valueType: 'date',
      editable: false,
      dataIndex: 'updatedAt',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('social.message.required') }],
        };
      },
    },
    {
      title: t('social.column.actions'),
      valueType: 'option',
      key: 'option',
      width: 200,
      render: (text, record, _, action) => [
        <a
          key="editable"
          onClick={() => {
            action?.startEditable?.(record.type);
          }}
        >
          {t('social.action.edit')}
        </a>,
        <a
          key="delete"
          onClick={async () => {
            Modal.confirm({
              onOk: async () => {
                await deleteSocial(record.type);
                action?.reload();
              },
              title: t('social.modal.deleteConfirm', { type: record.type }),
            });
          }}
        >
          {t('social.action.delete')}
        </a>,
      ],
    },
  ];
  return (
    <>
      <Spin spinning={loading}>
        <EditableProTable
          actionRef={actionRef}
          rowKey="key"
          headerTitle={t('social.table.header')}
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
                Modal.info({ title: t('social.modal.demoRestriction') });
                return;
              }
              const toSaveObj = {
                type: data.type,
                value: data.value,
              };
              await updateSocial(toSaveObj);
              actionRef?.current?.reload();
            },
            onChange: setEditableRowKeys,
          }}
        />
      </Spin>
    </>
  );
}
