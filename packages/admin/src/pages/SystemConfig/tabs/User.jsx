import CollaboratorModal, { getPermissionLabel } from '@/components/CollaboratorModal';
import Tags from '@/components/Tags';
import { deleteCollaborator, getAllCollaborators, updateUser } from '@/services/van-blog/api';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import { ProForm, ProFormText, ProTable } from '@ant-design/pro-components';
import { Button, Card, message, Modal, Space } from 'antd';
import { useRef } from 'react';
import { history, useModel } from '@/utils/umiCompat';

const trans_zh = {
  'user.id': 'ID',
  'user.username': '用户名',
  'user.nickname': '昵称',
  'user.permissions': '权限',
  'user.actions': '操作',
  'user.action.edit': '修改',
  'user.action.delete': '删除',
  'user.modal.delete.title': '删除确认',
  'user.modal.delete.content': '是否确认删除该协作者？',
  'user.message.delete.success': '删除成功！',
  'user.message.edit.success': '修改协作者成功！',
  'user.card.title': '用户设置',
  'user.form.username': '登录用户名',
  'user.form.username.placeholder': '请输入登录用户名',
  'user.form.password': '登录密码',
  'user.form.password.placeholder': '请输入登录密码',
  'user.form.required': '这是必填项',
  'user.message.update.success': '更新用户成功！请重新登录！',
  'user.collaborator.title': '协作者',
  'user.collaborator.button.new': '新建',
  'user.collaborator.button.help': '帮助',
  'user.collaborator.message.new.success': '新建协作者成功！',
  'user.collaborator.modal.help.title': '协作者功能',
  'user.collaborator.modal.help.content1': '您可以添加一些具有指定权限的协作者用户。',
  'user.collaborator.modal.help.content2':
    '协作者默认具有文章、草稿、图片的查看/上传权限，其余权限需要您显式指定。',
  'user.collaborator.modal.help.content3':
    '协作者登录后将看到被精简的后台页面（除非此协作者具备所有权限），同时无权限的接口将抛错。',
  'user.collaborator.doc.link': '帮助文档',
};

const columns = [
  { dataIndex: 'id', title: trans_zh['user.id'] },
  { dataIndex: 'name', title: trans_zh['user.username'] },
  { dataIndex: 'nickname', title: trans_zh['user.nickname'] },
  {
    dataIndex: 'permissions',
    title: trans_zh['user.permissions'],
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
    title: trans_zh['user.actions'],
    render: (text, record, _, action) => [
      <CollaboratorModal
        initialValues={record}
        id={record.id}
        key="edit"
        onFinish={() => {
          action?.reload();
          message.success(trans_zh['user.message.edit.success']);
        }}
        trigger={<a>{trans_zh['user.action.edit']}</a>}
      />,
      <a
        key="delete"
        style={{ marginLeft: 8 }}
        onClick={() => {
          Modal.confirm({
            title: trans_zh['user.modal.delete.title'],
            content: trans_zh['user.modal.delete.content'],
            onOk: async () => {
              await deleteCollaborator(record.id);
              action?.reload();
              message.success(trans_zh['user.message.delete.success']);
            },
          });
        }}
      >
        {trans_zh['user.action.delete']}
      </a>,
    ],
  },
];
export default function () {
  const { initialState, setInitialState } = useModel('@@initialState');
  const actionRef = useRef();
  return (
    <>
      <Card title={trans_zh['user.card.title']}>
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
              message.success(trans_zh['user.message.update.success']);
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
            rules={[{ required: true, message: trans_zh['user.form.required'] }]}
            label={trans_zh['user.form.username']}
            placeholder={trans_zh['user.form.username.placeholder']}
          />
          {/* <ProFormText
            width="lg"
            name="nickname"
            required={true}
            rules={[{ required: true, message: '这是必填项' }]}
            label="昵称"
            placeholder={'请输入昵称（显示的名字）'}
          ></ProFormText> */}
          <ProFormText.Password
            width="lg"
            name="password"
            required={true}
            rules={[{ required: true, message: trans_zh['user.form.required'] }]}
            autocomplete="new-password"
            label={trans_zh['user.form.password']}
            placeholder={trans_zh['user.form.password.placeholder']}
          />
        </ProForm>
      </Card>
      <Card
        title={trans_zh['user.collaborator.title']}
        style={{ marginTop: 8 }}
        className="card-body-full"
        extra={
          <Space>
            <CollaboratorModal
              onFinish={() => {
                message.success(trans_zh['user.collaborator.message.new.success']);
                actionRef.current?.reload();
              }}
              trigger={<Button type="primary">{trans_zh['user.collaborator.button.new']}</Button>}
            />
            <Button
              onClick={() => {
                Modal.info({
                  title: trans_zh['user.collaborator.modal.help.title'],
                  content: (
                    <div>
                      <p>
                        <span>{trans_zh['user.collaborator.modal.help.content1']}</span>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href="https://vanblog.mereith.com/feature/advance/collaborator.html"
                        >
                          {trans_zh['user.collaborator.doc.link']}
                        </a>
                      </p>
                      <p>{trans_zh['user.collaborator.modal.help.content2']}</p>
                      <p>{trans_zh['user.collaborator.modal.help.content3']}</p>
                    </div>
                  ),
                });
              }}
            >
              {trans_zh['user.collaborator.button.help']}
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
