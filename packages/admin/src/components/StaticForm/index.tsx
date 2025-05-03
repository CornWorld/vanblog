import React from 'react';
import { useTranslation } from 'react-i18next';
import { getStaticSetting, updateStaticSetting } from '@/services/van-blog/api';
import { ProForm, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useState } from 'react';

interface PicgoConfig {
  [key: string]: unknown;
}

interface StaticFormData {
  storageType: 'local' | 'picgo';
  picgoConfig?: string;
  picgoPlugins?: string;
}

interface SubmitData extends Omit<StaticFormData, 'picgoConfig'> {
  picgoConfig?: PicgoConfig | string;
}

export default function StaticForm() {
  const { t } = useTranslation();
  const [storageType, setStorageType] = useState<'local' | 'picgo'>('local');
  return (
    <>
      <ProForm
        grid={true}
        layout={'horizontal'}
        labelCol={{ span: 6 }}
        request={async () => {
          const { data } = await getStaticSetting();
          setStorageType(data?.storageType || 'local');
          if (!data) {
            return {
              storageType: 'local',
            };
          }
          return {
            ...data,
            picgoConfig: JSON.stringify(data?.picgoConfig || '', null, 2),
          };
        }}
        syncToInitialValues={true}
        onFinish={async (data: StaticFormData) => {
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: t('static_form.demo.title') });
            return;
          }
          setStorageType(data?.storageType || 'local');
          // 验证一下 json 格式
          let toUpload: SubmitData = { ...data };
          if (data?.storageType == 'picgo' && data?.picgoConfig != '') {
            try {
              const parsedConfig = JSON.parse(data?.picgoConfig || '{}');
              toUpload = { ...data, picgoConfig: parsedConfig };
            } catch (err) {
              console.error('Failed to parse picgoConfig JSON:', err);
              message.error(t('static_form.picgo_config.error'));
              return false;
            }
          }
          await updateStaticSetting(toUpload);
          message.success(t('static_form.update.success'));
          return true;
        }}
      >
        <ProFormSelect
          fieldProps={{
            onChange: (target: 'local' | 'picgo') => {
              setStorageType(target);
            },
          }}
          name="storageType"
          required
          label={t('static_form.storage_type.label')}
          placeholder={t('static_form.storage_type.placeholder')}
          valueEnum={{
            local: t('static_form.storage_type.local'),
            picgo: t('static_form.storage_type.picgo'),
          }}
          tooltip={t('static_form.storage_type.tooltip')}
          rules={[{ required: true, message: t('static_form.required') }]}
        ></ProFormSelect>
        {storageType == 'picgo' && (
          <>
            <ProFormTextArea
              name="picgoConfig"
              label={
                <a
                  href="https://vanblog.mereith.com/feature/basic/pic.html#%E5%A4%96%E7%BD%AE%E5%9B%BE%E5%BA%8A"
                  target={'_blank'}
                  rel="norefferrer"
                >
                  {t('static_form.picgo_config.label')}
                </a>
              }
              tooltip={'OSS 图床后端采用了 picgo'}
              placeholder={t('static_form.picgo_config.placeholder')}
              fieldProps={{
                autoSize: {
                  minRows: 10,
                  maxRows: 30,
                },
              }}
            />
            <ProFormText
              name="picgoPlugins"
              label={t('static_form.plugins.label')}
              tooltip={t('static_form.plugins.tooltip')}
              placeholder={t('static_form.plugins.placeholder')}
            />
          </>
        )}
      </ProForm>
    </>
  );
}
