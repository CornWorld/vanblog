import React from 'react';
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
import { ModalForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { Alert, Modal } from 'antd';

import { createCustomPage, updateCustomPage } from '@/services/van-blog/api';

export default ({
  onFinish,
  trigger,
  initialValues,
}: {
  onFinish: () => void;
  // FIXME: Add types
  trigger: unknown;
  // FIXME: Add types
  initialValues?: unknown;
}) => (
  <ModalForm
    title={initialValues ? t('custompage.modal.edit') : t('custompage.modal.new')}
    trigger={trigger}
    width={450}
    autoFocusFirstInput
    submitTimeout={3000}
    initialValues={initialValues}
    onFinish={async (values) => {
      // FIXME: Should be refactor in to an env variable controlling "A demo state"
      if (location.hostname === 'blog-demo.mereith.com') {
        Modal.info({
          title: t('custompage.demo.restricted'),
        });
        return;
      }

      const path = values.path as string;

      if (path.substring(0, 1) != '/') {
        Modal.info({
          title: t('custompage.path.error'),
        });
        return false;
      }

      if (initialValues) {
        await updateCustomPage({ ...values });
      } else {
        await createCustomPage(values);
      }

      if (onFinish) {
        onFinish();
      }

      return true;
    }}
    layout="horizontal"
    labelCol={{ span: 6 }}
  >
    {!initialValues && (
      <>
        <Alert style={{ marginBottom: 8 }} type="info" message={t('custompage.alert.hint')} />
        <ProFormSelect
          width="md"
          name="type"
          required
          tooltip={t('custompage.field.type.tooltip')}
          label={t('custompage.field.type')}
          placeholder={t('custompage.field.type.placeholder')}
          rules={[{ required: true, message: t('custompage.field.required') }]}
          initialValue={'folder'}
          request={async () => {
            return [
              { label: t('custompage.type.single'), value: 'file' },
              { label: t('custompage.type.multi'), value: 'folder' },
            ];
          }}
        />
      </>
    )}
    <ProFormText
      width="md"
      required
      id="name"
      name="name"
      label={t('custompage.field.name')}
      placeholder={t('custompage.field.name.placeholder')}
      tooltip={t('custompage.field.name.tooltip')}
      rules={[{ required: true, message: t('custompage.field.required') }]}
    />
    <ProFormText
      disabled={initialValues && initialValues.type == 'folder'}
      width="md"
      required
      id="path"
      name="path"
      label={t('custompage.field.path')}
      placeholder={t('custompage.field.path.placeholder')}
      tooltip={t('custompage.field.path.tooltip')}
      rules={[{ required: true, message: t('custompage.field.required') }]}
    />
  </ModalForm>
);
