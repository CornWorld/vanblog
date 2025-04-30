import { deleteDonate, getDonate, updateDonate } from '@/services/van-blog/api';
import { EditableProTable } from '@ant-design/pro-components';
import { Modal, Spin } from 'antd';
import { useRef, useState } from 'react';

const trans_zh = {
  'donate.table.header': '捐赠详情',
  'donate.column.name': '捐赠人',
  'donate.column.value': '金额',
  'donate.column.updatedAt': '最后捐赠时间',
  'donate.column.actions': '操作',
  'donate.action.edit': '编辑',
  'donate.action.delete': '删除',
  'donate.message.required': '此项为必填项',
  'donate.modal.deleteConfirm': '确认删除"{name}"的捐赠吗?',
};

export default function () {
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
      title: trans_zh['donate.column.name'],
      dataIndex: 'name',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['donate.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['donate.column.value'],
      valueType: 'money',
      dataIndex: 'value',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['donate.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['donate.column.updatedAt'],
      valueType: 'date',
      editable: false,
      dataIndex: 'updatedAt',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['donate.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['donate.column.actions'],
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
          {trans_zh['donate.action.edit']}
        </a>,
        <a
          key="delete"
          onClick={async () => {
            Modal.confirm({
              onOk: async () => {
                await deleteDonate(record.name);
                action?.reload();
              },
              title: trans_zh['donate.modal.deleteConfirm'].replace('{name}', record.name),
            });
          }}
        >
          {trans_zh['donate.action.delete']}
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
          headerTitle={trans_zh['donate.table.header']}
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
