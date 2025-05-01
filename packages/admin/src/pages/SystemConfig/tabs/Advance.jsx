import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  activeISR,
  getISRConfig,
  getLoginConfig,
  updateISRConfig,
  updateLoginConfig,
} from '@/services/van-blog/api';
import { ProForm, ProFormDigit, ProFormSelect } from '@ant-design/pro-components';
import { Alert, Button, Card, message, Modal } from 'antd';
import { useState } from 'react';

export default function () {
  const { t } = useTranslation();
  const [isrLoading, setIsrLoading] = useState(false);
  return (
    <>
      <Card title={t('advance.login.card.title')}>
        <Alert
          type="warning"
          message={t('advance.login.alert.warning')}
          style={{ marginBottom: 8 }}
        />
        <ProForm
          grid={true}
          layout={'horizontal'}
          request={async () => {
            try {
              const { data } = await getLoginConfig();
              return data || { enableMaxLoginRetry: false };
            } catch (err) {
              console.log(err);
              return { enableMaxLoginRetry: false };
            }
          }}
          syncToInitialValues={true}
          onFinish={async (data) => {
            if (location.hostname == 'blog-demo.mereith.com') {
              Modal.info({ title: t('advance.login.modal.demo') });
              return;
            }
            await updateLoginConfig(data);
            message.success(t('advance.login.message.success'));
          }}
        >
          <ProFormSelect
            disabled={true}
            name={'enableMaxLoginRetry'}
            label={t('advance.login.form.max_retry.label')}
            fieldProps={{
              options: [
                {
                  label: t('advance.login.form.max_retry.option.enabled'),
                  value: true,
                },
                {
                  label: t('advance.login.form.max_retry.option.disabled'),
                  value: false,
                },
              ],
            }}
            placeholder={t('advance.login.form.max_retry.placeholder')}
            tooltip={t('advance.login.form.max_retry.tooltip')}
          ></ProFormSelect>
          <ProFormDigit
            name={'expiresIn'}
            label={t('advance.login.form.expires.label')}
            placeholder={t('advance.login.form.expires.placeholder')}
            tooltip={t('advance.login.form.expires.tooltip')}
          />
        </ProForm>
      </Card>

      <Card title={t('advance.isr.card.title')} style={{ marginTop: 8 }}>
        <Alert
          type="info"
          message={
            <a
              rel="noreferrer"
              target="_blank"
              href="https://vanblog.mereith.com/feature/advance/isr.html"
            >
              {t('advance.isr.help.link')}
            </a>
          }
          style={{ marginBottom: 8 }}
        />
        <ProForm
          grid={true}
          layout={'horizontal'}
          request={async () => {
            try {
              const { data } = await getISRConfig();
              return data;
            } catch (err) {
              console.log(err);
              return {};
            }
          }}
          syncToInitialValues={true}
          onFinish={async (data) => {
            if (location.hostname == 'blog-demo.mereith.com') {
              Modal.info({ title: t('advance.isr.modal.demo') });
              return;
            }
            await updateISRConfig(data);
            message.success(t('advance.isr.message.success'));
          }}
        >
          <ProFormSelect
            name={'mode'}
            label={t('advance.isr.form.mode.label')}
            fieldProps={{
              options: [
                {
                  label: t('advance.isr.form.mode.option.delay'),
                  value: 'delay',
                },
                {
                  label: t('advance.isr.form.mode.option.on_demand'),
                  value: 'onDemand',
                },
              ],
            }}
            tooltip={t('advance.isr.form.mode.tooltip')}
          ></ProFormSelect>
          <ProFormDigit
            name={'delay'}
            label={t('advance.isr.form.delay.label')}
            tooltip={t('advance.isr.form.delay.tooltip')}
          />
        </ProForm>
      </Card>
      <Card title={t('advance.isr_manual.card.title')} style={{ marginTop: 8 }}>
        <Alert
          type="info"
          message={t('advance.isr_manual.alert.info')}
          style={{ marginBottom: 8 }}
        />
        <Button
          type="primary"
          onClick={async () => {
            setIsrLoading(true);
            try {
              await activeISR();
              message.success(t('advance.isr_manual.message.success'));
            } catch (error) {
              console.error('ISR activation error:', error);
              message.error(t('advance.isr_manual.message.error'));
            }
            setIsrLoading(false);
          }}
          loading={isrLoading}
        >
          {t('advance.isr_manual.button')}
        </Button>
      </Card>
    </>
  );
}
