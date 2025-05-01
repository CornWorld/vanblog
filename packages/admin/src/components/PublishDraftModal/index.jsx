import React from 'react';
import { useTranslation } from 'react-i18next';
import { publishDraft } from '@/services/van-blog/api';
import { ModalForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { message, Modal } from 'antd';

export default function (props) {
  const { t } = useTranslation();
  const { title, id, trigger, action } = props;
  return (
    <>
      <ModalForm
        title={t('publish.modal.title', { title: title })}
        key="publishModal"
        trigger={trigger}
        width={450}
        autoFocusFirstInput
        submitTimeout={3000}
        onFinish={async (values) => {
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({
              title: t('publish.modal.demo.title'),
              content: t('publish.modal.demo.content'),
            });
            return;
          }
          await publishDraft(id, {
            ...values,
            password: values.pc,
            top: values.Ctop,
          });
          message.success(t('publish.message.success'));
          if (action && action.reload) {
            action.reload();
          }
          if (props.onFinish) {
            props.onFinish();
          }
          return true;
        }}
        layout="horizontal"
        labelCol={{ span: 6 }}
      >
        <ProFormSelect
          width="md"
          name="private"
          id="private"
          label={t('publish.field.private')}
          placeholder={t('publish.field.private.placeholder')}
          request={async () => {
            return [
              {
                label: t('publish.field.option.no'),
                value: false,
              },
              {
                label: t('publish.field.option.yes'),
                value: true,
              },
            ];
          }}
        />
        <ProFormText
          label={t('publish.field.toppriority')}
          width="md"
          id="top"
          name="Ctop"
          placeholder={t('publish.field.toppriority.placeholder')}
          autocomplete="new-password"
          fieldProps={{
            autocomplete: 'new-password',
          }}
        />
        <ProFormText
          width="md"
          id="pathname"
          name="pathname"
          label={t('publish.field.pathname')}
          tooltip={t('publish.field.pathname.tooltip')}
          placeholder={t('publish.field.pathname.placeholder')}
        />
        <ProFormText.Password
          label={t('publish.field.password')}
          width="md"
          autocomplete="new-password"
          id="password"
          name="pc"
          placeholder={t('publish.field.password.placeholder')}
          dependencies={['private']}
          fieldProps={{
            autocomplete: 'new-password',
          }}
        />
        <ProFormSelect
          width="md"
          name="hidden"
          id="hidden"
          label={t('publish.field.hidden')}
          placeholder={t('publish.field.hidden.placeholder')}
          request={async () => {
            return [
              {
                label: t('publish.field.option.no'),
                value: false,
              },
              {
                label: t('publish.field.option.yes'),
                value: true,
              },
            ];
          }}
        />
        <ProFormText
          width="md"
          id="copyright"
          name="copyright"
          label={t('publish.field.copyright')}
          tooltip={t('publish.field.copyright.tooltip')}
          placeholder={t('publish.field.copyright.placeholder')}
        />
      </ModalForm>
    </>
  );
}
