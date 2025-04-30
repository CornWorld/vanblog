import { deleteSocial, getSocial, getSocialTypes, updateSocial } from '@/services/van-blog/api';
import { EditableProTable } from '@ant-design/pro-components';
import { Modal, Spin } from 'antd';
import { useRef, useState } from 'react';

const trans_zh = {
  'social.column.type': '类型',
  'social.column.value': '值',
  'social.column.updatedAt': '最后设置时间',
  'social.column.actions': '操作',
  'social.action.edit': '编辑',
  'social.action.delete': '删除',
  'social.message.required': '此项为必填项',
  'social.modal.deleteConfirm': '确认删除"{type}"吗?',
  'social.modal.demoRestriction': '演示站禁止修改此项！',
  'social.table.header': '联系方式',
};

export default function () {
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
      title: trans_zh['social.column.type'],
      dataIndex: 'type',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['social.message.required'] }],
        };
      },
      request: async () => {
        const { data } = await getSocialTypes();
        return data || [];
      },
    },
    {
      title: trans_zh['social.column.value'],
      dataIndex: 'value',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['social.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['social.column.updatedAt'],
      valueType: 'date',
      editable: false,
      dataIndex: 'updatedAt',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['social.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['social.column.actions'],
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
          {trans_zh['social.action.edit']}
        </a>,
        <a
          key="delete"
          onClick={async () => {
            Modal.confirm({
              onOk: async () => {
                await deleteSocial(record.type);
                action?.reload();
              },
              title: trans_zh['social.modal.deleteConfirm'].replace('{type}', record.type),
            });
          }}
        >
          {trans_zh['social.action.delete']}
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
          headerTitle={trans_zh['social.table.header']}
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
                Modal.info({ title: trans_zh['social.modal.demoRestriction'] });
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
