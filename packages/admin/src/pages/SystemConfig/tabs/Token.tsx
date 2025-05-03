import React from 'react';
import { useTranslation, TFunction } from 'react-i18next';
import { createApiToken, getAllApiTokens, deleteApiToken } from '@/services/van-blog/api';
import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { Button, Card, message, Modal, Space, Typography } from 'antd';

import { useRef } from 'react';

interface TokenRecord {
  _id: string;
  name: string;
  token: string;
}

const getColumns = ({ t }: { t: TFunction }): ProColumns<TokenRecord>[] => [
  { dataIndex: '_id', title: t('token.column.id') },
  { dataIndex: 'name', title: t('token.column.name') },
  {
    dataIndex: 'token',
    title: t('token.column.content'),
    render: (_: React.ReactNode, entity: TokenRecord) => {
      return (
        <Typography.Text style={{ maxWidth: 250 }} ellipsis={true} copyable={true}>
          {entity.token}
        </Typography.Text>
      );
    },
  },
  {
    title: t('token.column.actions'),
    render: (_: unknown, record: TokenRecord, __: unknown, action?: ActionType) => [
      <a
        key="delete"
        style={{ marginLeft: 8 }}
        onClick={() => {
          Modal.confirm({
            title: t('token.modal.delete.title'),
            content: t('token.modal.delete.content'),
            onOk: async () => {
              await deleteApiToken(record._id);
              action?.reload();
              message.success(t('token.message.delete.success'));
            },
          });
        }}
      >
        {t('token.action.delete')}
      </a>,
    ],
  },
];

export default function Token() {
  const { t } = useTranslation();
  const actionRef = useRef<ActionType>(null);
  return (
    <>
      <Card
        title={t('token.card.title')}
        style={{ marginTop: 8 }}
        className="card-body-full"
        extra={
          <Space>
            <ModalForm
              title={t('token.modal.new.title')}
              trigger={<Button type="primary">{t('token.button.new')}</Button>}
              onFinish={async (vals) => {
                await createApiToken(vals);
                actionRef.current?.reload();
                return true;
              }}
            >
              <ProFormText label={t('token.field.name')} name="name" />
            </ModalForm>
            <Button
              onClick={() => {
                window.open('/swagger', '_blank');
              }}
            >
              {t('token.button.api_docs')}
            </Button>
            <Button
              onClick={() => {
                Modal.info({
                  title: t('token.modal.help.title'),
                  content: (
                    <div>
                      <p>{t('token.modal.help.content1')}</p>
                      <p>{t('token.modal.help.content2')}</p>
                      <p>{t('token.modal.help.content3')}</p>
                      <p>{t('token.modal.help.content4')}</p>
                      <p>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://vanblog.mereith.com/advanced/token.html"
                        >
                          {t('token.modal.help.docs')}
                        </a>
                      </p>
                    </div>
                  ),
                });
              }}
            >
              {t('token.button.help')}
            </Button>
          </Space>
        }
      >
        <ProTable<TokenRecord>
          rowKey="id"
          columns={getColumns({ t })}
          dateFormatter="string"
          actionRef={actionRef}
          search={false}
          options={false}
          pagination={{
            hideOnSinglePage: true,
            simple: true,
          }}
          request={async () => {
            const { data = [] } = (await getAllApiTokens()) as { data: TokenRecord[] };
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
