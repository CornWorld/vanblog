import React from 'react';
import { useTranslation } from 'react-i18next';
import { getWalineConfig, updateWalineConfig } from '@/services/van-blog/api';
import {
  ProForm,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useState } from 'react';

interface WalineConfig {
  'smtp.enabled': boolean;
  forceLoginComment: boolean;
  webhook?: string;
  'smtp.host'?: string;
  'smtp.port'?: number;
  'smtp.user'?: string;
  'smtp.password'?: string;
  authorEmail?: string;
  'sender.name'?: string;
  'sender.email'?: string;
  otherConfig?: string;
}

export default function WalineForm() {
  const { t } = useTranslation();
  const [enableEmail, setEnableEmail] = useState<boolean>(false);
  return (
    <>
      <ProForm
        grid={true}
        layout={'horizontal'}
        labelCol={{ span: 6 }}
        request={async () => {
          try {
            const { data } = await getWalineConfig();
            setEnableEmail(data?.['smtp.enabled'] || false);
            if (!data) {
              return {
                'smtp.enabled': false,
                forceLoginComment: false,
              };
            }
            return { ...data };
          } catch (err) {
            console.error('Failed to fetch Waline config:', err);
            return {
              'smtp.enabled': false,
              forceLoginComment: false,
            };
          }
        }}
        syncToInitialValues={true}
        onFinish={async (data: WalineConfig) => {
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: t('demo.restricted') });
            return;
          }
          if (data.otherConfig) {
            try {
              JSON.parse(data.otherConfig);
            } catch (err) {
              console.error('JSON parse error:', err);
              Modal.info({ title: t('json.invalid') });
              return;
            }
          }
          setEnableEmail(data?.['smtp.enabled'] || false);
          try {
            await updateWalineConfig(data);
            message.success(t('update.success'));
          } catch (err) {
            console.error('Failed to update Waline config:', err);
            message.error(t('caddy.update.error'));
          }
        }}
      >
        <ProFormText
          name="webhook"
          label={t('webhook.label')}
          tooltip={t('webhook.tooltip')}
          placeholder={t('webhook.placeholder')}
        />
        <ProFormSelect
          fieldProps={{
            options: [
              {
                label: t('login.option.enabled'),
                value: true,
              },
              {
                label: t('login.option.disabled'),
                value: false,
              },
            ],
          }}
          name="forceLoginComment"
          label={t('login.label')}
          placeholder={t('login.placeholder')}
        ></ProFormSelect>
        <ProFormSelect
          fieldProps={{
            onChange: (target: boolean) => {
              setEnableEmail(target);
            },
            options: [
              {
                label: t('login.option.enabled'),
                value: true,
              },
              {
                label: t('login.option.disabled'),
                value: false,
              },
            ],
          }}
          name="smtp.enabled"
          label={t('email.label')}
          tooltip={t('email.tooltip')}
          placeholder={t('email.placeholder')}
        ></ProFormSelect>
        {enableEmail && (
          <>
            <ProFormText
              name="smtp.host"
              label={t('smtp.host.label')}
              tooltip={t('smtp.host.tooltip')}
              placeholder={t('smtp.host.placeholder')}
              rules={[{ required: true, message: t('field.required') }]}
            />
            <ProFormDigit
              name="smtp.port"
              label={t('smtp.port.label')}
              tooltip={t('smtp.port.tooltip')}
              placeholder={t('smtp.port.placeholder')}
              rules={[{ required: true, message: t('field.required') }]}
            />
            <ProFormText
              name="smtp.user"
              label={t('smtp.user.label')}
              tooltip={t('smtp.user.tooltip')}
              placeholder={t('smtp.user.placeholder')}
              rules={[{ required: true, message: t('field.required') }]}
            />
            <ProFormText.Password
              name="smtp.password"
              label={t('smtp.password.label')}
              tooltip={t('smtp.password.tooltip')}
              placeholder={t('smtp.password.placeholder')}
              rules={[{ required: true, message: t('field.required') }]}
            />
            <ProFormText
              name="authorEmail"
              label={t('author.email.label')}
              tooltip={t('author.email.tooltip')}
              placeholder={t('author.email.placeholder')}
              rules={[{ required: true, message: t('field.required') }]}
            />
            <ProFormText
              name="sender.name"
              label={t('sender.name.label')}
              tooltip={t('sender.name.tooltip')}
              placeholder={t('sender.name.placeholder')}
            />
            <ProFormText
              name="sender.email"
              label={t('sender.email.label')}
              tooltip={t('sender.email.tooltip')}
              placeholder={t('sender.email.placeholder')}
            />
          </>
        )}
        <ProFormTextArea
          name="otherConfig"
          label={
            <a
              href="https://waline.js.org/reference/server.html"
              target={'_blank'}
              rel="norefferrer"
            >
              {t('other.config.label')}
            </a>
          }
          tooltip={t('other.config.tooltip')}
          placeholder={t('other.config.placeholder')}
          fieldProps={{
            autoSize: {
              minRows: 10,
              maxRows: 30,
            },
          }}
        />
      </ProForm>
    </>
  );
}
