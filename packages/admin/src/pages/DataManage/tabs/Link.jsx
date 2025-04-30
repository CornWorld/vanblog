import { deleteLink, getLink, updateLink } from '@/services/van-blog/api';
import { EditableProTable } from '@ant-design/pro-components';
import { Modal, Spin } from 'antd';
import { useRef, useState } from 'react';

const trans_zh = {
  'link.table.header': '友情链接',
  'link.column.name': '伙伴名',
  'link.column.url': '地址',
  'link.column.desc': '简介',
  'link.column.logo': 'Logo',
  'link.column.updatedAt': '最后设置时间',
  'link.column.actions': '操作',
  'link.action.edit': '编辑',
  'link.action.delete': '删除',
  'link.message.required': '此项为必填项',
  'link.modal.deleteConfirm': '确认删除"{name}"吗?',
  'link.modal.demoRestriction': '演示站禁止修改此项！',
};

export default function () {
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
      title: trans_zh['link.column.name'],
      dataIndex: 'name',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['link.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['link.column.url'],
      dataIndex: 'url',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['link.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['link.column.desc'],
      dataIndex: 'desc',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['link.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['link.column.logo'],
      dataIndex: 'logo',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['link.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['link.column.updatedAt'],
      valueType: 'date',
      editable: false,
      dataIndex: 'updatedAt',
      formItemProps: () => {
        return {
          rules: [{ required: true, message: trans_zh['link.message.required'] }],
        };
      },
    },
    {
      title: trans_zh['link.column.actions'],
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
          {trans_zh['link.action.edit']}
        </a>,
        <a
          key="delete"
          onClick={async () => {
            Modal.confirm({
              onOk: async () => {
                await deleteLink(record.name);
                action?.reload();
              },
              title: trans_zh['link.modal.deleteConfirm'].replace('{name}', record.name),
            });
          }}
        >
          {trans_zh['link.action.delete']}
        </a>,
      ],
    },
  ];
  return (
    <>
      <Spin spinning={loading}>
        <EditableProTable
          rowKey="key"
          headerTitle={trans_zh['link.table.header']}
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
                Modal.info({ title: trans_zh['link.modal.demoRestriction'] });
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
