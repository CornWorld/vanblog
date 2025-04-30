import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
} from '@/services/van-blog/api';
import { encodeQuerystring } from '@/services/van-blog/encode';
import { PlusOutlined } from '@ant-design/icons';
import { ModalForm, ProFormSelect, ProFormText, ProTable } from '@ant-design/pro-components';
import { Button, message, Modal } from 'antd';
import { useRef } from 'react';

const trans_zh = {
  'category.column.name': '题目',
  'category.column.private': '加密',
  'category.column.private.tooltip':
    '分类加密后，此分类下的所有文章都会被加密。密码以分类的密码为准。加密后，访客仍可正常访问分类并获取文章列表。',
  'category.status.private': '加密',
  'category.status.public': '未加密',
  'category.column.actions': '操作',
  'category.action.view': '查看',
  'category.action.edit': '修改',
  'category.action.delete': '删除',
  'category.modal.edit.title': '修改分类',
  'category.modal.edit.error.empty': '无有效信息！请至少填写一个选项！',
  'category.modal.edit.error.password': '如若加密，请填写密码！',
  'category.modal.edit.confirm': '确定修改分类',
  'category.modal.edit.confirm.suffix': '吗？改动将立即生效!',
  'category.modal.edit.success': '提交成功',
  'category.form.name': '分类名',
  'category.form.name.placeholder': '请输入新的分类名称',
  'category.form.private': '是否加密',
  'category.form.private.placeholder': '是否加密',
  'category.form.password': '密码',
  'category.form.password.placeholder': '请输入加密密码',
  'category.modal.delete.title': '确定删除分类',
  'category.modal.delete.success': '删除成功!',
  'category.button.new': '新建分类',
  'category.modal.new.title': '新建分类',
  'category.modal.new.success': '新建分类成功！',
  'category.form.required': '这是必填项',
};

const columns = [
  {
    dataIndex: 'name',
    title: trans_zh['category.column.name'],
    search: false,
  },
  {
    title: trans_zh['category.column.private'],
    tooltip: trans_zh['category.column.private.tooltip'],
    dataIndex: 'private',
    search: false,
    valueType: 'select',
    valueEnum: {
      [true]: {
        text: trans_zh['category.status.private'],
        status: 'Error',
      },
      [false]: {
        text: trans_zh['category.status.public'],
        status: 'Success',
      },
    },
  },
  {
    title: trans_zh['category.column.actions'],
    valueType: 'option',
    width: 200,
    render: (text, record, _, action) => [
      <a
        key="viewCategory"
        onClick={() => {
          window.open(`/category/${encodeQuerystring(record.name)}`, '_blank');
        }}
      >
        {trans_zh['category.action.view']}
      </a>,
      <ModalForm
        key={`editCateoryC%{${record.name}}`}
        title={`${trans_zh['category.modal.edit.title']} "${record.name}"`}
        trigger={<a key={'editC' + record.name}>{trans_zh['category.action.edit']}</a>}
        autoFocusFirstInput
        initialValues={{
          password: record.password,
          private: record.private,
        }}
        submitTimeout={3000}
        onFinish={async (values) => {
          if (Object.keys(values).length == 0) {
            message.error(trans_zh['category.modal.edit.error.empty']);
            return false;
          }
          if (values.private && !values.password) {
            message.error(trans_zh['category.modal.edit.error.password']);
            return false;
          }

          Modal.confirm({
            content: `${trans_zh['category.modal.edit.confirm']} "${record.name}" ${trans_zh['category.modal.edit.confirm.suffix']}`,
            onOk: async () => {
              await updateCategory(record.name, values);
              message.success(trans_zh['category.modal.edit.success']);
              action?.reload();
              return true;
            },
          });

          return true;
        }}
      >
        <ProFormText
          width="md"
          name="name"
          label={trans_zh['category.form.name']}
          placeholder={trans_zh['category.form.name.placeholder']}
        />
        <ProFormSelect
          width="md"
          name="private"
          label={trans_zh['category.form.private']}
          placeholder={trans_zh['category.form.private.placeholder']}
          request={async () => {
            return [
              { label: trans_zh['category.status.public'], value: false },
              { label: trans_zh['category.status.private'], value: true },
            ];
          }}
        />
        <ProFormText.Password
          width="md"
          name="password"
          label={trans_zh['category.form.password']}
          placeholder={trans_zh['category.form.password.placeholder']}
        />
      </ModalForm>,

      <a
        key={'deleteCategoryC' + record.name}
        onClick={() => {
          Modal.confirm({
            title: `${trans_zh['category.modal.delete.title']} "${record.name}"吗？`,
            onOk: async () => {
              try {
                await deleteCategory(record.name);
                message.success(trans_zh['category.modal.delete.success']);
              } catch (error) {
                console.error('Error deleting category:', error);
                message.error(trans_zh['category.modal.delete.error'] || '删除分类失败');
              }
              action?.reload();
            },
          });
          // action?.startEditable?.(record.id);
        }}
      >
        {trans_zh['category.action.delete']}
      </a>,
    ],
  },
];

export default function () {
  const fetchData = async () => {
    const { data: res } = await getAllCategories(true);
    return Array.isArray(res)
      ? res.map((item) => ({
          key: item.id,
          ...item,
        }))
      : [];
  };
  const actionRef = useRef();
  return (
    <>
      <ProTable
        rowKey="name"
        columns={columns}
        search={false}
        dateFormatter="string"
        // headerTitle="分类"
        actionRef={actionRef}
        options={false}
        toolBarRender={() => [
          <ModalForm
            title={trans_zh['category.modal.new.title']}
            key="newCategoryN"
            trigger={
              <Button key="buttonCN" icon={<PlusOutlined />} type="primary">
                {trans_zh['category.button.new']}
              </Button>
            }
            width={450}
            autoFocusFirstInput
            submitTimeout={3000}
            onFinish={async (values) => {
              await createCategory(values);
              actionRef?.current?.reload();
              message.success(trans_zh['category.modal.new.success']);
              return true;
            }}
            layout="horizontal"
            labelCol={{ span: 6 }}
          >
            <ProFormText
              width="md"
              required
              id="nameC"
              name="name"
              label={trans_zh['category.form.name']}
              key="nameCCCC"
              placeholder={trans_zh['category.form.name.placeholder']}
              rules={[{ required: true, message: trans_zh['category.form.required'] }]}
            />
          </ModalForm>,
        ]}
        request={async () => {
          const data = await fetchData();
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
