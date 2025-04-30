import { createCollaborator, updateCollaborator } from '@/services/van-blog/api';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import { ModalForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import React from 'react';

const trans_zh = {
  'collaborator.modal.edit': '修改协作者',
  'collaborator.modal.new': '新建协作者',
  'collaborator.permission.article.create': '创建-文章',
  'collaborator.permission.article.update': '修改-文章',
  'collaborator.permission.article.delete': '删除-文章',
  'collaborator.permission.draft.publish': '发布-草稿',
  'collaborator.permission.draft.create': '创建-草稿',
  'collaborator.permission.draft.update': '修改-草稿',
  'collaborator.permission.draft.delete': '删除-草稿',
  'collaborator.permission.img.delete': '删除-图片',
  'collaborator.permission.all': '所有权限',
  'collaborator.field.username': '用户名',
  'collaborator.field.username.placeholder': '请输协作者用户名',
  'collaborator.field.username.tooltip': '协作者用来登录的用户名',
  'collaborator.field.nickname': '昵称',
  'collaborator.field.nickname.placeholder': '请输协作者昵称',
  'collaborator.field.nickname.tooltip': '协作者显示的名字',
  'collaborator.field.password': '密码',
  'collaborator.field.password.placeholder': '请输协作者密码',
  'collaborator.field.password.tooltip': '协作者登录的密码',
  'collaborator.field.permissions': '权限',
  'collaborator.field.permissions.placeholder': '请选择协作者具有的权限',
  'collaborator.field.permissions.tooltip': '协作者具有的权限',
  'collaborator.field.required': '这是必填项',
};

// TODO: Extract this
const PERMISSION_OPTIONS = [
  {
    label: trans_zh['collaborator.permission.article.create'],
    value: 'article:create',
  },
  {
    label: trans_zh['collaborator.permission.article.update'],
    value: 'article:update',
  },
  {
    label: trans_zh['collaborator.permission.article.delete'],
    value: 'article:delete',
  },
  {
    label: trans_zh['collaborator.permission.draft.publish'],
    value: 'draft:publish',
  },
  {
    label: trans_zh['collaborator.permission.draft.create'],
    value: 'draft:create',
  },
  {
    label: trans_zh['collaborator.permission.draft.update'],
    value: 'draft:update',
  },
  {
    label: trans_zh['collaborator.permission.draft.delete'],
    value: 'draft:delete',
  },
  {
    label: trans_zh['collaborator.permission.img.delete'],
    value: 'img:delete',
  },
  {
    label: trans_zh['collaborator.permission.all'],
    value: 'all',
  },
];
export const getPermissionLabel = (permissionId: string): string | undefined =>
  PERMISSION_OPTIONS.find(({ value }) => {
    return value == permissionId;
  })?.label;

interface CollaboratorModalProps {
  onFinish?: () => void;
  id?: string | number;
  trigger: React.ReactNode;
  initialValues?: {
    name?: string;
    nickname?: string;
    password?: string;
    permissions?: string[];
  };
}

export default ({ onFinish, id, trigger, initialValues }: CollaboratorModalProps) => (
  <ModalForm
    title={id ? trans_zh['collaborator.modal.edit'] : trans_zh['collaborator.modal.new']}
    trigger={trigger}
    width={450}
    autoFocusFirstInput
    submitTimeout={3000}
    initialValues={initialValues || undefined}
    onFinish={async (values) => {
      if (id) {
        await updateCollaborator({
          id,
          ...values,
          password: encryptPwd(values.name, values.password),
        });
      } else {
        await createCollaborator({
          ...values,
          password: encryptPwd(values.name, values.password),
        });
      }

      if (onFinish) {
        onFinish();
      }

      return true;
    }}
    layout="horizontal"
    labelCol={{ span: 6 }}
    // wrapperCol: { span: 14 },
  >
    <ProFormText
      width="md"
      required
      id="name"
      name="name"
      label={trans_zh['collaborator.field.username']}
      placeholder={trans_zh['collaborator.field.username.placeholder']}
      tooltip={trans_zh['collaborator.field.username.tooltip']}
      rules={[{ required: true, message: trans_zh['collaborator.field.required'] }]}
    />
    <ProFormText
      width="md"
      required
      id="nickname"
      name="nickname"
      label={trans_zh['collaborator.field.nickname']}
      placeholder={trans_zh['collaborator.field.nickname.placeholder']}
      tooltip={trans_zh['collaborator.field.nickname.tooltip']}
      rules={[{ required: true, message: trans_zh['collaborator.field.required'] }]}
    />
    <ProFormText.Password
      width="md"
      required
      id="password"
      name="password"
      label={trans_zh['collaborator.field.password']}
      placeholder={trans_zh['collaborator.field.password.placeholder']}
      tooltip={trans_zh['collaborator.field.password.tooltip']}
      rules={[{ required: true, message: trans_zh['collaborator.field.required'] }]}
    />
    <ProFormSelect
      width="md"
      required
      rules={[{ required: true, message: trans_zh['collaborator.field.required'] }]}
      name="permissions"
      label={trans_zh['collaborator.field.permissions']}
      placeholder={trans_zh['collaborator.field.permissions.placeholder']}
      tooltip={trans_zh['collaborator.field.permissions.tooltip']}
      fieldProps={{
        mode: 'multiple',
        options: PERMISSION_OPTIONS,
      }}
    />
  </ModalForm>
);
