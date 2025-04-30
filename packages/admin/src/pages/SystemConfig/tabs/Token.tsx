import { createApiToken, getAllApiTokens, deleteApiToken } from '@/services/van-blog/api';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ActionType } from '@ant-design/pro-components';
import { Button, Card, message, Modal, Space, Typography } from 'antd';

import { useRef } from 'react';

const trans_zh = {
  'token.column.id': 'ID',
  'token.column.name': '名称',
  'token.column.content': '内容',
  'token.column.actions': '操作',
  'token.action.delete': '删除',
  'token.modal.delete.title': '删除确认',
  'token.modal.delete.content': '是否确认删除该 Token？',
  'token.message.delete.success': '删除成功！',
  'token.card.title': 'Token 管理',
  'token.button.new': '新建',
  'token.modal.new.title': '新建 API Token',
  'token.field.name': '名称',
  'token.button.api_docs': 'API 文档',
  'token.button.help': '帮助',
  'token.modal.help.title': 'Token 管理功能介绍',
  'token.modal.help.content1': '创建的 Api Token 可以用来调用 VanBlog 的 API',
  'token.modal.help.content2': '结合 API 文档，您可以做到很多有意思的事情。',
  'token.modal.help.content3':
    'API 文档现在比较水，会慢慢完善的，未来会有 API Playgroud，敬请期待。',
  'token.modal.help.content4':
    'PS：暂时没必要通过 API 开发自己的前台，后面会出主题功能（完善的文档和开发指南，不限制技术栈），届时再开发会更好。',
  'token.modal.help.docs': '相关文档',
};

interface TokenRecord {
  _id: string;
  name: string;
  token: string;
}

const columns = [
  { dataIndex: '_id', title: trans_zh['token.column.id'] },
  { dataIndex: 'name', title: trans_zh['token.column.name'] },
  {
    dataIndex: 'token',
    title: trans_zh['token.column.content'],
    render: (token: string) => {
      return (
        <Typography.Text style={{ maxWidth: 250 }} ellipsis={true} copyable={true}>
          {token}
        </Typography.Text>
      );
    },
  },
  {
    title: trans_zh['token.column.actions'],
    render: (_: unknown, record: TokenRecord, __: unknown, action?: ActionType) => [
      <a
        key="delete"
        style={{ marginLeft: 8 }}
        onClick={() => {
          Modal.confirm({
            title: trans_zh['token.modal.delete.title'],
            content: trans_zh['token.modal.delete.content'],
            onOk: async () => {
              await deleteApiToken(record._id);
              action?.reload();
              message.success(trans_zh['token.message.delete.success']);
            },
          });
        }}
      >
        {trans_zh['token.action.delete']}
      </a>,
    ],
  },
];

export default function () {
  const actionRef = useRef<ActionType>();
  return (
    <>
      <Card
        title={trans_zh['token.card.title']}
        style={{ marginTop: 8 }}
        className="card-body-full"
        extra={
          <Space>
            <ModalForm
              title={trans_zh['token.modal.new.title']}
              trigger={<Button type="primary">{trans_zh['token.button.new']}</Button>}
              onFinish={async (vals) => {
                await createApiToken(vals);
                actionRef.current?.reload();
                return true;
              }}
            >
              <ProFormText label={trans_zh['token.field.name']} name="name" />
            </ModalForm>
            <Button
              onClick={() => {
                window.open('/swagger', '_blank');
              }}
            >
              {trans_zh['token.button.api_docs']}
            </Button>
            <Button
              onClick={() => {
                Modal.info({
                  title: trans_zh['token.modal.help.title'],
                  content: (
                    <div>
                      <p>{trans_zh['token.modal.help.content1']}</p>
                      <p>{trans_zh['token.modal.help.content2']}</p>
                      <p>{trans_zh['token.modal.help.content3']}</p>
                      <p>{trans_zh['token.modal.help.content4']}</p>
                      <p>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://vanblog.mereith.com/advanced/token.html"
                        >
                          {trans_zh['token.modal.help.docs']}
                        </a>
                      </p>
                    </div>
                  ),
                });
              }}
            >
              {trans_zh['token.button.help']}
            </Button>
          </Space>
        }
      >
        <ProTable
          rowKey="id"
          columns={columns}
          dateFormatter="string"
          actionRef={actionRef}
          search={false}
          options={false}
          pagination={{
            hideOnSinglePage: true,
            simple: true,
          }}
          request={async () => {
            const { data } = await getAllApiTokens();
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
      </Card>
    </>
  );
}
