import React from 'react';
import { useTranslation } from 'react-i18next';
import { deleteTag, getTags, updateTag } from '@/services/van-blog/api';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useRef } from 'react';

export default function () {
  const { t } = useTranslation();
  const actionRef = useRef();

  const columns = [
    {
      dataIndex: 'name',
      title: t('tag.column.name'),
      search: true,
      fieldProps: { showSearch: true, placeholder: t('tag.column.name.placeholder') },
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
      title: t('tag.column.actions'),
      valueType: 'option',
      width: 200,
      render: (text, record, _, action) => [
        <a
          key="viewTag"
          onClick={() => {
            window.open(`/tag/${record.name.replace(/#/g, '%23')}`, '_blank');
          }}
        >
          {t('tag.action.view')}
        </a>,
        <ModalForm
          key={`editCateoryC%{${record.name}}`}
          title={`${t('tag.modal.edit.title')} "${record.name}"`}
          trigger={<a key={'editC' + record.name}>{t('tag.action.batch_rename')}</a>}
          autoFocusFirstInput
          submitTimeout={3000}
          onFinish={async (values) => {
            Modal.confirm({
              content: `${t('tag.modal.edit.confirm')} "${record.name}" ${t('tag.modal.edit.confirm.suffix')}`,
              onOk: async () => {
                await updateTag(record.name, values.newName);
                message.success(t('tag.modal.edit.success'));
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
            label={t('tag.form.new_name')}
            placeholder={t('tag.form.new_name.placeholder')}
            tooltip={t('tag.form.new_name.tooltip')}
            required
            rules={[{ required: true, message: t('tag.form.required') }]}
          />
        </ModalForm>,
        <a
          key="delTag"
          onClick={() => {
            Modal.confirm({
              title: t('tag.modal.delete.title'),
              content: t('tag.modal.delete.content'),
              onOk: async () => {
                await deleteTag(record.name);
                message.success(t('tag.modal.delete.success'));
                action?.reload();
                return true;
              },
            });
          }}
        >
          {t('tag.action.delete')}
        </a>,
      ],
    },
  ];

  const fetchData = async () => {
    const { data: res } = await getTags();
    return res.map((item) => ({
      key: item,
      name: item,
    }));
  };

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
