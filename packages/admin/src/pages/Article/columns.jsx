import React from 'react';
import { useTranslation } from 'react-i18next';
import ColumnsToolBar from '@/components/ColumnsToolBar';
import UpdateModal from '@/components/UpdateModal';
import { deleteArticle, getAllCategories, getArticleById, getTags } from '@/services/van-blog/api';
import { getPathname } from '@/services/van-blog/getPathname';
import { parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { message, Modal, Space, Tag, Button } from 'antd';
import { history } from '@/router';
import { genActiveObj } from '../../services/van-blog/activeColTools';
import { withoutKey } from '@/utils/props';

export const articleKeys = [
  'category',
  'id',
  'option',
  'showTime',
  'tags',
  'title',
  'top',
  'viewer',
];
export const articleKeysSmall = ['category', 'id', 'option', 'title'];
export const articleObjAll = genActiveObj(articleKeys, articleKeys);
export const articleObjSmall = genActiveObj(articleKeysSmall, articleKeys);

export const getColumns = ({ t }) => [
  {
    dataIndex: 'id',
    valueType: 'number',
    title: t('article.column.id'),
    width: 48,
    search: false,
  },
  {
    title: t('article.column.title'),
    dataIndex: 'title',
    copyable: true,
    width: 150,
    ellipsis: true,
    formItemProps: {
      rules: [
        {
          required: true,
          message: t('article.column.required'),
        },
      ],
    },
  },
  {
    title: t('article.column.category'),
    dataIndex: 'category',
    valueType: 'select',
    width: 100,
    request: async () => {
      const { data: categories } = await getAllCategories();
      const data = categories.map((each) => ({
        label: each,
        value: each,
      }));
      return data;
    },
  },
  {
    title: t('article.column.tags'),
    dataIndex: 'tags',
    valueType: 'select',
    fieldProps: { showSearch: true, placeholder: t('article.column.tags.placeholder') },
    width: 120,
    search: true,
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
    title: t('article.column.created_time'),
    key: 'showTime',
    dataIndex: 'createdAt',
    valueType: 'dateTime',
    sorter: true,
    hideInSearch: true,
    width: 150,
  },
  {
    title: t('article.column.top'),
    key: 'top',
    dataIndex: 'top',
    valueType: 'number',
    sorter: true,
    width: 80,
    hideInSearch: true,
  },
  {
    title: t('article.column.viewer'),
    key: 'viewer',
    dataIndex: 'viewer',
    valueType: 'number',
    sorter: true,
    width: 80,
    hideInSearch: true,
  },
  {
    title: t('article.column.created_time'),
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
    title: '操作',
    valueType: 'option',
    key: 'option',
    width: 120,
    render: (text, record, _, action) => {
      return (
        <Space>
          <ColumnsToolBar
            outs={[
              <a
                key={'editable' + record.id}
                onClick={() => {
                  history.push(
                    `/editor?type=${record?.about ? 'about' : 'article'}&id=${record.id}`,
                  );
                }}
              >
                {t('article.action.edit')}
              </a>,
              <a
                href={`/post/${getPathname(record)}`}
                onClick={(ev) => {
                  if (record?.hidden) {
                    Modal.confirm({
                      title: t('article.modal.hidden_title'),
                      content: (
                        <div>
                          <p>{t('article.modal.hidden_content1')}</p>
                          <p>
                            {t('article.modal.hidden_content2')}
                            <a
                              onClick={() => {
                                history.push('/site/setting?subTab=layout');
                              }}
                            >
                              {t('article.modal.hidden_content3')}
                            </a>
                            {t('article.modal.hidden_content4')}
                          </p>
                        </div>
                      ),
                      onOk: () => {
                        window.open(`/post/${getPathname(record)}`, '_blank');
                        return true;
                      },
                      okText: t('article.modal.hidden_ok'),
                      cancelText: t('article.modal.hidden_cancel'),
                    });
                    ev.preventDefault();
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                key={'view' + record.id}
              >
                {t('article.action.view')}
              </a>,
            ]}
            nodes={[
              <UpdateModal
                currObj={record}
                setLoading={() => {}}
                type="article"
                onFinish={() => {
                  action?.reload();
                }}
              />,
              <a
                key={'exportArticle' + record.id}
                onClick={async () => {
                  const { data: obj } = await getArticleById(record.id);
                  const md = parseObjToMarkdown(obj);
                  const data = new Blob([md]);
                  const url = URL.createObjectURL(data);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${record.title}.md`;
                  link.click();
                }}
              >
                {t('article.action.export')}
              </a>,
              <Button
                key={'deleteBtn' + record.id}
                type="link"
                danger
                onClick={() => {
                  Modal.confirm({
                    title: t('article.modal.delete_title'),
                    content: t('article.modal.delete_content'),
                    okText: t('article.modal.delete_ok'),
                    cancelText: t('article.modal.delete_cancel'),
                    onOk: async () => {
                      try {
                        await deleteArticle(record.id);
                        message.success(t('article.message.delete_success'));
                        action?.reload();
                      } catch {
                        message.error(t('article.message.delete_error'));
                      }
                    },
                  });
                }}
              >
                {t('article.action.delete')}
              </Button>,
            ]}
          />
        </Space>
      );
    },
  },
];
