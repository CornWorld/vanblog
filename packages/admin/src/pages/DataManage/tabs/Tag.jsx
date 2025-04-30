import { deleteTag, getTags, updateTag } from '@/services/van-blog/api';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useRef } from 'react';

const trans_zh = {
  'tag.column.name': '标签名',
  'tag.column.name.placeholder': '请搜索或选择',
  'tag.column.actions': '操作',
  'tag.action.view': '查看',
  'tag.action.batch_rename': '批量改名',
  'tag.action.delete': '删除',
  'tag.modal.edit.title': '批量修改标签',
  'tag.modal.edit.confirm': '确定修改标签',
  'tag.modal.edit.confirm.suffix': '吗？所有文章的该标签都将被更新为新名称!',
  'tag.modal.edit.success': '更新成功！所有文章该标签都将变为新名称！',
  'tag.form.new_name': '新标签',
  'tag.form.new_name.placeholder': '请输入新的标签名称',
  'tag.form.new_name.tooltip': '所有文章的该标签都将被更新为新名称',
  'tag.form.required': '这是必填项',
  'tag.modal.delete.title': '确认删除',
  'tag.modal.delete.content': '确认删除该标签吗？所有文章的该标签都将被删除，其他标签不变。',
  'tag.modal.delete.success': '删除成功！所有文章的该标签都将被删除，其他标签不变。',
};

const columns = [
  {
    dataIndex: 'name',
    title: trans_zh['tag.column.name'],
    search: true,
    fieldProps: { showSearch: true, placeholder: trans_zh['tag.column.name.placeholder'] },
    request: async () => {
      const { data: tags } = await getTags();
      const data = tags.map((each) => ({
        label: each,
        value: each,
      }));
      return data;
    },
    // render: (text) => {
    //   return <span style={{ marginLeft: 8 }}>{text}</span>;
    // },
  },
  {
    title: trans_zh['tag.column.actions'],
    valueType: 'option',
    width: 200,
    render: (text, record, _, action) => [
      <a
        key="viewTag"
        onClick={() => {
          window.open(`/tag/${record.name.replace(/#/g, '%23')}`, '_blank');
        }}
      >
        {trans_zh['tag.action.view']}
      </a>,
      <ModalForm
        key={`editCateoryC%{${record.name}}`}
        title={`${trans_zh['tag.modal.edit.title']} "${record.name}"`}
        trigger={<a key={'editC' + record.name}>{trans_zh['tag.action.batch_rename']}</a>}
        autoFocusFirstInput
        submitTimeout={3000}
        onFinish={async (values) => {
          Modal.confirm({
            content: `${trans_zh['tag.modal.edit.confirm']} "${record.name}" ${trans_zh['tag.modal.edit.confirm.suffix']}`,
            onOk: async () => {
              await updateTag(record.name, values.newName);
              message.success(trans_zh['tag.modal.edit.success']);
              action?.reload();
              return true;
            },
          });

          return true;
        }}
      >
        <ProFormText
          width="lg"
          name="newName"
          label={trans_zh['tag.form.new_name']}
          placeholder={trans_zh['tag.form.new_name.placeholder']}
          tooltip={trans_zh['tag.form.new_name.tooltip']}
          required
          rules={[{ required: true, message: trans_zh['tag.form.required'] }]}
        />
      </ModalForm>,
      <a
        key="delTag"
        onClick={() => {
          Modal.confirm({
            title: trans_zh['tag.modal.delete.title'],
            content: trans_zh['tag.modal.delete.content'],
            onOk: async () => {
              await deleteTag(record.name);
              message.success(trans_zh['tag.modal.delete.success']);
              action?.reload();
              return true;
            },
          });
        }}
      >
        {trans_zh['tag.action.delete']}
      </a>,
    ],
  },
];
export default function () {
  const fetchData = async () => {
    const { data: res } = await getTags();
    return res.map((item) => ({
      key: item,
      name: item,
    }));
  };
  const actionRef = useRef();
  return (
    <>
      <ProTable
        rowKey="name"
        columns={columns}
        dateFormatter="string"
        actionRef={actionRef}
        search={{
          collapseRender: () => {
            return null;
          },
          collapsed: false,
        }}
        options={false}
        request={async (params = {}) => {
          let data = await fetchData();
          if (params?.name) {
            data = [{ key: params?.name, name: params?.name }];
          }
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
    </>
  );
}
