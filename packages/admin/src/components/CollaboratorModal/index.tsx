import { createCollaborator, updateCollaborator } from '@/services/van-blog/api';
import i18next from 'i18next';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import { ModalForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import React from 'react';

// TODO: Extract this
const PERMISSION_OPTIONS = [
  {
    label: i18next.t('collaborator.permission.article.create'),
    value: 'article:create',
  },
  {
    label: i18next.t('collaborator.permission.article.update'),
    value: 'article:update',
  },
  {
    label: i18next.t('collaborator.permission.article.delete'),
    value: 'article:delete',
  },
  {
    label: i18next.t('collaborator.permission.draft.publish'),
    value: 'draft:publish',
  },
  {
    label: i18next.t('collaborator.permission.draft.create'),
    value: 'draft:create',
  },
  {
    label: i18next.t('collaborator.permission.draft.update'),
    value: 'draft:update',
  },
  {
    label: i18next.t('collaborator.permission.draft.delete'),
    value: 'draft:delete',
  },
  {
    label: i18next.t('collaborator.permission.img.delete'),
    value: 'img:delete',
  },
  {
    label: i18next.t('collaborator.permission.all'),
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
    title={id ? i18next.t('collaborator.modal.edit') : i18next.t('collaborator.modal.new')}
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
      label={i18next.t('collaborator.field.username')}
      placeholder={i18next.t('collaborator.field.username.placeholder')}
      tooltip={i18next.t('collaborator.field.username.tooltip')}
      rules={[{ required: true, message: i18next.t('collaborator.field.required') }]}
    />
    <ProFormText
      width="md"
      required
      id="nickname"
      name="nickname"
      label={i18next.t('collaborator.field.nickname')}
      placeholder={i18next.t('collaborator.field.nickname.placeholder')}
      tooltip={i18next.t('collaborator.field.nickname.tooltip')}
      rules={[{ required: true, message: i18next.t('collaborator.field.required') }]}
    />
    <ProFormText.Password
      width="md"
      required
      id="password"
      name="password"
      label={i18next.t('collaborator.field.password')}
      placeholder={i18next.t('collaborator.field.password.placeholder')}
      tooltip={i18next.t('collaborator.field.password.tooltip')}
      rules={[{ required: true, message: i18next.t('collaborator.field.required') }]}
    />
    <ProFormSelect
      width="md"
      required
      rules={[{ required: true, message: i18next.t('collaborator.field.required') }]}
      name="permissions"
      label={i18next.t('collaborator.field.permissions')}
      placeholder={i18next.t('collaborator.field.permissions.placeholder')}
      tooltip={i18next.t('collaborator.field.permissions.tooltip')}
      fieldProps={{
        mode: 'multiple',
        options: PERMISSION_OPTIONS,
      }}
    />
  </ModalForm>
);
