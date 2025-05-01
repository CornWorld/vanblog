import React from 'react';
import { useTranslation } from 'react-i18next';
import { deleteDonate, getDonate, updateDonate } from '@/services/van-blog/api';
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
    const { data } = await getDonate();
    setLoading(false);
    return data.map((item) => ({ key: item.name, ...item }));
  };
  const columns = [
    {
      title: t('donate.column.name'),
      dataIndex: 'name',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('donate.message.required') }],
        };
      },
    },
    {
      title: t('donate.column.value'),
      valueType: 'money',
      dataIndex: 'value',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('donate.message.required') }],
        };
      },
    },
    {
      title: t('donate.column.updatedAt'),
      valueType: 'date',
      editable: false,
      dataIndex: 'updatedAt',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: t('donate.message.required') }],
        };
      },
    },
    {
      title: t('donate.column.actions'),
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
          {t('donate.action.edit')}
        </a>,
        <a
          key="delete"
          onClick={async () => {
            Modal.confirm({
              onOk: async () => {
                await deleteDonate(record.name);
                action?.reload();
              },
              title: t('donate.modal.deleteConfirm', { name: record.name }),
            });
          }}
        >
          {t('donate.action.delete')}
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
          headerTitle={t('donate.table.header')}
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
              total: data.length,
            };
          }}
          editable={{
            type: 'multiple',
            editableKeys,
            onSave: async (rowKey, data) => {
              await updateDonate(data);
              actionRef?.current?.reload();
            },
            onChange: setEditableRowKeys,
          }}
        />
      </Spin>
    </>
  );
}
