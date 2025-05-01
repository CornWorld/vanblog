import React from 'react';
import { useTranslation } from 'react-i18next';
import ColumnsToolBar from '@/components/ColumnsToolBar';
import PublishDraftModal from '@/components/PublishDraftModal';
import UpdateModal from '@/components/UpdateModal';
import { genActiveObj } from '@/services/van-blog/activeColTools';
import { deleteDraft, getAllCategories, getDraftById, getTags } from '@/services/van-blog/api';
import { parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { message, Modal, Tag } from 'antd';
import { history } from '@/router';
import { withoutKey } from '@/utils/props';

const { t } = useTranslation();

export const columns = [
  {
    dataIndex: 'id',
    valueType: 'number',
    title: t('draft.column.id'),
    width: 48,
    search: false,
  },
  {
    title: t('draft.column.title'),
    dataIndex: 'title',
    copyable: true,
    ellipsis: true,
    width: 150,
    tip: t('draft.column.title.tip'),
    formItemProps: {
      rules: [
        {
          required: true,
          message: t('draft.column.required'),
        },
      ],
    },
  },
  {
    title: t('draft.column.category'),
    dataIndex: 'category',
    width: 120,
    valueType: 'select',
    request: async () => {
      const { data: categories } = await getAllCategories();
      const data = categories?.map((each) => ({
        label: each,
        value: each,
      }));

      return data;
    },
  },
  {
    title: t('draft.column.tags'),
    dataIndex: 'tags',
    search: true,
    fieldProps: { showSearch: true, placeholder: t('draft.column.tags.placeholder') },
    valueType: 'select',
    width: 120,
    renderFormItem: (item, { defaultRender }) => {
      return defaultRender(withoutKey(item));
    },
    request: async () => {
      const { data: tags } = await getTags();
      const data = tags.map((each) => ({
        label: each,
        value: each,
      }));
      return data;
    },
    render: (val, record) => {
      if (!record?.tags?.length) {
        return '-';
      } else {
        return record?.tags?.map((each) => (
          <Tag style={{ marginBottom: 4 }} key={`tag-${each}`}>
            {each}
          </Tag>
        ));
      }
    },
  },
  {
    title: t('draft.column.created_time'),
    key: 'showTime',
    dataIndex: 'createdAt',
    valueType: 'dateTime',
    sorter: true,
    hideInSearch: true,
    width: 150,
  },
  {
    title: t('draft.column.created_time'),
    dataIndex: 'createdAt',
    valueType: 'dateRange',
    hideInTable: true,
    search: {
      transform: (value) => {
        return {
          startTime: value[0],
          endTime: value[1],
        };
      },
    },
  },
  {
    title: t('draft.column.operation'),
    valueType: 'option',
    key: 'option',
    width: 120,
    render: (text, record, _, action) => {
      return (
        <ColumnsToolBar
          outs={[
            <a
              key={'editable' + record.id}
              onClick={() => {
                history.push(`/editor?type=draft&id=${record.id}`);
              }}
            >
              {t('draft.action.edit')}
            </a>,
            <PublishDraftModal
              key="publishRecord1213"
              title={record.title}
              id={record.id}
              action={action}
              trigger={<a key="publishRecord123">{t('draft.action.publish')}</a>}
            />,
          ]}
          nodes={[
            <UpdateModal
              currObj={record}
              setLoading={() => {}}
              type="draft"
              onFinish={() => {
                action?.reload();
              }}
            />,
            <a
              key={'exportDraft' + record.id}
              onClick={async () => {
                const { data: obj } = await getDraftById(record.id);
                const md = parseObjToMarkdown(obj);
                const data = new Blob([md]);
                const url = URL.createObjectURL(data);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${record.title}.md`;
                link.click();
              }}
            >
              {t('draft.action.export')}
            </a>,
            <a
              key={'deleteDraft' + record.id}
              onClick={() => {
                Modal.confirm({
                  title: `${t('draft.modal.delete.title')} "${record.title}" 吗？`,
                  onOk: async () => {
                    await deleteDraft(record.id);
                    message.success(t('draft.message.delete.success'));
                    action?.reload();
                  },
                });
              }}
            >
              {t('draft.action.delete')}
            </a>,
          ]}
        ></ColumnsToolBar>
      );
    },
  },
];
export const draftKeys = ['category', 'id', 'option', 'showTime', 'tags', 'title'];
export const draftKeysSmall = ['category', 'id', 'option', 'title'];

export const draftKeysObj = genActiveObj(draftKeys, draftKeys);
export const draftKeysObjSmall = genActiveObj(draftKeysSmall, draftKeys);
