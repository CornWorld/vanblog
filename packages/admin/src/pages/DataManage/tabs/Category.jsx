import React from 'react';
import { useTranslation } from 'react-i18next';
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

export default function () {
  const { t } = useTranslation();
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

  const columns = [
    {
      dataIndex: 'name',
      title: t('category.column.name'),
      search: false,
    },
    {
      title: t('category.column.private'),
      tooltip: t('category.column.private.tooltip'),
      dataIndex: 'private',
      search: false,
      valueType: 'select',
      valueEnum: {
        [true]: {
          text: t('category.status.private'),
          status: 'Error',
        },
        [false]: {
          text: t('category.status.public'),
          status: 'Success',
        },
      },
    },
    {
      title: t('category.column.actions'),
      valueType: 'option',
      width: 200,
      render: (text, record, _, action) => [
        <a
          key="viewCategory"
          onClick={() => {
            window.open(`/category/${encodeQuerystring(record.name)}`, '_blank');
          }}
        >
          {t('category.action.view')}
        </a>,
        <ModalForm
          key={`editCateoryC%{${record.name}}`}
          title={`${t('category.modal.edit.title')} "${record.name}"`}
          trigger={<a key={'editC' + record.name}>{t('category.action.edit')}</a>}
          autoFocusFirstInput
          initialValues={{
            password: record.password,
            private: record.private,
          }}
          submitTimeout={3000}
          onFinish={async (values) => {
            if (Object.keys(values).length == 0) {
              message.error(t('category.modal.edit.error.empty'));
              return false;
            }
            if (values.private && !values.password) {
              message.error(t('category.modal.edit.error.password'));
              return false;
            }

            Modal.confirm({
              content: `${t('category.modal.edit.confirm')} "${record.name}" ${t('category.modal.edit.confirm.suffix')}`,
              onOk: async () => {
                await updateCategory(record.name, values);
                message.success(t('category.modal.edit.success'));
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
            label={t('category.form.name')}
            placeholder={t('category.form.name.placeholder')}
          />
          <ProFormSelect
            width="md"
            name="private"
            label={t('category.form.private')}
            placeholder={t('category.form.private.placeholder')}
            request={async () => {
              return [
                { label: t('category.status.public'), value: false },
                { label: t('category.status.private'), value: true },
              ];
            }}
          />
          <ProFormText.Password
            width="md"
            name="password"
            label={t('category.form.password')}
            placeholder={t('category.form.password.placeholder')}
          />
        </ModalForm>,

        <a
          key={'deleteCategoryC' + record.name}
          onClick={() => {
            Modal.confirm({
              title: `${t('category.modal.delete.title')} "${record.name}"吗？`,
              onOk: async () => {
                try {
                  await deleteCategory(record.name);
                  message.success(t('category.modal.delete.success'));
                } catch (error) {
                  console.error('Error deleting category:', error);
                  message.error(t('category.modal.delete.error') || '删除分类失败');
                }
                action?.reload();
              },
            });
            // action?.startEditable?.(record.id);
          }}
        >
          {t('category.action.delete')}
        </a>,
      ],
    },
  ];

  return (
    <>
      <ProTable
        rowKey="name"
        columns={columns}
        search={false}
        dateFormatter="string"
        // headerTitle=t('editor.header.category')
        actionRef={actionRef}
        options={false}
        toolBarRender={() => [
          <ModalForm
            title={t('category.modal.new.title')}
            key="newCategoryN"
            trigger={
              <Button key="buttonCN" icon={<PlusOutlined />} type="primary">
                {t('category.button.new')}
              </Button>
            }
            width={450}
            autoFocusFirstInput
            submitTimeout={3000}
            onFinish={async (values) => {
              await createCategory(values);
              actionRef?.current?.reload();
              message.success(t('category.modal.new.success'));
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
              label={t('category.form.name')}
              key="nameCCCC"
              placeholder={t('category.form.name.placeholder')}
              rules={[{ required: true, message: t('category.form.required') }]}
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
