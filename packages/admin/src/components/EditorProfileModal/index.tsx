import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModalForm, ProFormSelect } from '@ant-design/pro-form';
import { Alert, message } from 'antd';
import { ReactNode } from 'react';

interface EditorProfileProps {
  setValue: (value: Record<string, unknown>) => void;
  value: Record<string, unknown>;
  trigger: ReactNode;
}

export default function (props: EditorProfileProps) {
  const { t } = useTranslation();
  const { setValue, value, trigger } = props;
  return (
    <ModalForm
      title={t('editor_profile.modal.title')}
      trigger={trigger}
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      initialValues={value || {}}
      onFinish={async (vals) => {
        setValue({ ...value, ...vals });
        message.success(t('editor_profile.save.success'));
        return true;
      }}
      layout="horizontal"
      labelCol={{ span: 6 }}
      key="editForm"
    >
      <Alert
        type="info"
        message={t('editor_profile.alert.message')}
        style={{ marginBottom: 8 }}
      ></Alert>

      <ProFormSelect
        width="md"
        required
        id="afterSave"
        name="afterSave"
        label={t('editor_profile.field.after_save')}
        placeholder={t('editor_profile.field.after_save.placeholder')}
        request={async () => {
          return [
            {
              label: t('editor_profile.after_save.stay'),
              value: 'stay',
            },
            {
              label: t('editor_profile.after_save.back'),
              value: 'goBack',
            },
          ];
        }}
      />

      <ProFormSelect
        width="md"
        required
        id="useLocalCache"
        name="useLocalCache"
        label={t('editor_profile.field.local_cache')}
        tooltip={t('editor_profile.field.local_cache.tooltip')}
        placeholder={t('editor_profile.field.local_cache.placeholder')}
        request={async () => {
          return [
            {
              label: t('editor_profile.option.enabled'),
              value: 'open',
            },
            {
              label: t('editor_profile.option.disabled'),
              value: 'close',
            },
          ];
        }}
      />
    </ModalForm>
  );
}
