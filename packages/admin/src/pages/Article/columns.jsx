import ColumnsToolBar from '@/components/ColumnsToolBar';
import UpdateModal from '@/components/UpdateModal';
import { deleteArticle, getAllCategories, getArticleById, getTags } from '@/services/van-blog/api';
import { getPathname } from '@/services/van-blog/getPathname';
import { parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { message, Modal, Space, Tag, Button } from 'antd';
import { history } from '@/router';
import { genActiveObj } from '../../services/van-blog/activeColTools';
import { withoutKey } from '@/utils/props';

const trans_zh = {
  'article.column.id': 'ID',
  'article.column.title': '标题',
  'article.column.required': '此项为必填项',
  'article.column.category': '分类',
  'article.column.tags': '标签',
  'article.column.tags.placeholder': '请搜索或选择',
  'article.column.created_time': '创建时间',
  'article.column.top': '顶置',
  'article.column.viewer': '浏览量',
  'article.action.edit': '编辑',
  'article.action.view': '查看',
  'article.modal.hidden_title': '此文章为隐藏文章！',
  'article.modal.hidden_content1':
    '隐藏文章在未开启通过 URL 访问的情况下（默认关闭），会出现 404 页面！',
  'article.modal.hidden_content2': '您可以在',
  'article.modal.hidden_content3': '布局配置',
  'article.modal.hidden_content4': '中修改此项。',
  'article.modal.hidden_ok': '仍然访问',
  'article.modal.hidden_cancel': '返回',
  'article.action.export': '导出',
  'article.modal.delete_title': '确定删除此文章吗？',
  'article.modal.delete_content': '此操作将删除文章及其所有相关数据，包括评论、访问记录等。',
  'article.modal.delete_ok': '确定',
  'article.modal.delete_cancel': '取消',
  'article.message.delete_success': '文章删除成功！',
  'article.message.delete_error': '文章删除失败，请稍后再试。',
};

export const columns = [
  {
    dataIndex: 'id',
    valueType: 'number',
    title: trans_zh['article.column.id'],
    width: 48,
    search: false,
  },
  {
    title: trans_zh['article.column.title'],
    dataIndex: 'title',
    width: 150,
    copyable: true,
    ellipsis: true,
    formItemProps: {
      rules: [
        {
          required: true,
          message: trans_zh['article.column.required'],
        },
      ],
    },
  },
  {
    title: trans_zh['article.column.category'],
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
    title: trans_zh['article.column.tags'],
    dataIndex: 'tags',
    valueType: 'select',
    fieldProps: { showSearch: true, placeholder: trans_zh['article.column.tags.placeholder'] },
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
    title: trans_zh['article.column.created_time'],
    key: 'showTime',
    dataIndex: 'createdAt',
    valueType: 'dateTime',
    sorter: true,
    hideInSearch: true,
    width: 150,
  },
  {
    title: trans_zh['article.column.top'],
    key: 'top',
    dataIndex: 'top',
    valueType: 'number',
    sorter: true,
    width: 80,
    hideInSearch: true,
  },
  {
    title: trans_zh['article.column.viewer'],
    key: 'viewer',
    dataIndex: 'viewer',
    valueType: 'number',
    sorter: true,
    width: 80,
    hideInSearch: true,
  },
  {
    title: trans_zh['article.column.created_time'],
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
                {trans_zh['article.action.edit']}
              </a>,
              <a
                href={`/post/${getPathname(record)}`}
                onClick={(ev) => {
                  if (record?.hidden) {
                    Modal.confirm({
                      title: trans_zh['article.modal.hidden_title'],
                      content: (
                        <div>
                          <p>{trans_zh['article.modal.hidden_content1']}</p>
                          <p>
                            {trans_zh['article.modal.hidden_content2']}
                            <a
                              onClick={() => {
                                history.push('/site/setting?subTab=layout');
                              }}
                            >
                              {trans_zh['article.modal.hidden_content3']}
                            </a>
                            {trans_zh['article.modal.hidden_content4']}
                          </p>
                        </div>
                      ),
                      onOk: () => {
                        window.open(`/post/${getPathname(record)}`, '_blank');
                        return true;
                      },
                      okText: trans_zh['article.modal.hidden_ok'],
                      cancelText: trans_zh['article.modal.hidden_cancel'],
                    });
                    ev.preventDefault();
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                key={'view' + record.id}
              >
                {trans_zh['article.action.view']}
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
                {trans_zh['article.action.export']}
              </a>,
              <Button
                key={'deleteBtn' + record.id}
                type="link"
                danger
                onClick={() => {
                  Modal.confirm({
                    title: trans_zh['article.modal.delete_title'],
                    content: trans_zh['article.modal.delete_content'],
                    okText: trans_zh['article.modal.delete_ok'],
                    cancelText: trans_zh['article.modal.delete_cancel'],
                    onOk: async () => {
                      try {
                        await deleteArticle(record.id);
                        message.success(trans_zh['article.message.delete_success']);
                        action?.reload();
                      } catch {
                        message.error(trans_zh['article.message.delete_error']);
                      }
                    },
                  });
                }}
              >
                {trans_zh['article.action.delete']}
              </Button>,
            ]}
          />
        </Space>
      );
    },
  },
];
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
