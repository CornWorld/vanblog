import React from 'react';
import { useTranslation } from 'react-i18next';
import CollaboratorModal, { getPermissionLabel } from '@/components/CollaboratorModal';
import Tags from '@/components/Tags';
import { deleteCollaborator, getAllCollaborators, updateUser } from '@/services/van-blog/api';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import { ProForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { Button, Card, message, Modal, Space } from 'antd';
import { useRef } from 'react';
import { history, useModel } from '@/router';

export default function () {
  const { t } = useTranslation();
  const { initialState, setInitialState } = useModel('@@initialState');
  const actionRef = useRef();

  const columns = [
    { dataIndex: 'id', title: t('user.id') },
    { dataIndex: 'name', title: t('user.username') },
    { dataIndex: 'nickname', title: t('user.nickname') },
    {
      dataIndex: 'permissions',
      title: t('user.permissions'),
      render: (data) => {
        return (
          <Tags
            tags={data.map((t) => {
              return getPermissionLabel(t);
            })}
          />
        );
      },
    },
    {
      title: t('user.actions'),
      render: (text, record, _, action) => [
        <CollaboratorModal
          initialValues={record}
          id={record.id}
          key="edit"
          onFinish={() => {
            action?.reload();
            message.success(t('user.message.edit.success'));
          }}
          trigger={<a>{t('user.action.edit')}</a>}
        />,
        <a
          key="delete"
          style={{ marginLeft: 8 }}
          onClick={() => {
            Modal.confirm({
              title: t('user.modal.delete.title'),
              content: t('user.modal.delete.content'),
              onOk: async () => {
                await deleteCollaborator(record.id);
                action?.reload();
                message.success(t('user.message.delete.success'));
              },
            });
          }}
        >
          {t('user.action.delete')}
        </a>,
      ],
    },
  ];

  return (
    <>
      <Card title={t('user.card.title')}>
        <ProForm
          grid={true}
          layout={'horizontal'}
          labelCol={{ span: 6 }}
          request={async () => {
            return {
              name: initialState?.user?.name || '',
              password: initialState?.user?.password || '',
            };
          }}
          syncToInitialValues={true}
          onFinish={async (data) => {
            try {
              await updateUser({
                name: data.name,
                password: encryptPwd(data.name, data.password),
              });
              window.localStorage.removeItem('token');
              setInitialState((s) => ({ ...s, user: undefined }));
              history.push('/');
              message.success(t('user.message.update.success'));
            } catch (error) {
              console.error('Failed to update user:', error);
              message.error('Failed to update user information');
            }
          }}
        >
          <ProFormText
            width="lg"
            name="name"
            required={true}
            rules={[{ required: true, message: t('user.form.required') }]}
            label={t('user.form.username')}
            placeholder={t('user.form.username.placeholder')}
          />
          {/* <ProFormText
            width="lg"
            name="nickname"
            required={true}
            rules={[{ required: true, message: '这是必填项' }]}
            label=t('user.nickname')
            placeholder={'请输入昵称（显示的名字）'}
          ></ProFormText> */}
          <ProFormText.Password
            width="lg"
            name="password"
            required={true}
            rules={[{ required: true, message: t('user.form.required') }]}
            autocomplete="new-password"
            label={t('user.form.password')}
            placeholder={t('user.form.password.placeholder')}
          />
        </ProForm>
      </Card>
      <Card
        title={t('user.collaborator.title')}
        style={{ marginTop: 8 }}
        className="card-body-full"
        extra={
          <Space>
            <CollaboratorModal
              onFinish={() => {
                message.success(t('user.collaborator.message.new.success'));
                actionRef.current?.reload();
              }}
              trigger={<Button type="primary">{t('user.collaborator.button.new')}</Button>}
            />
            <Button
              onClick={() => {
                Modal.info({
                  title: t('user.collaborator.modal.help.title'),
                  content: (
                    <div>
                      <p>
                        <span>{t('user.collaborator.modal.help.content1')}</span>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://vanblog.mereith.com/feature/advance/collaborator.html"
                        >
                          {t('user.collaborator.doc.link')}
                        </a>
                      </p>
                      <p>{t('user.collaborator.modal.help.content2')}</p>
                      <p>{t('user.collaborator.modal.help.content3')}</p>
                    </div>
                  ),
                });
              }}
            >
              {t('user.collaborator.button.help')}
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
            try {
              const { data } = await getAllCollaborators();
              return {
                data,
                success: true,
                total: data.length,
              };
            } catch (error) {
              console.error('Failed to get collaborators:', error);
              message.error('Failed to load collaborators');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
        />
      </Card>
    </>
  );
}
