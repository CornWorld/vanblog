import React from 'react';
import { useTranslation } from 'react-i18next';
import { getStaticSetting, updateStaticSetting } from '@/services/van-blog/api';
import { checkNoChinese } from '@/services/van-blog/checkString';
import { ProForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useState } from 'react';

interface WatermarkFormData {
  enableWaterMark?: boolean;
  enableWebp?: boolean;
  waterMarkText?: string;
  [key: string]: unknown;
}

export default function WaterMarkForm() {
  const { t } = useTranslation();
  const [enableWaterMark, setEnableWaterMark] = useState<boolean>(false);
  return (
    <>
      <ProForm
        grid={true}
        layout={'horizontal'}
        labelCol={{ span: 6 }}
        request={async () => {
          const { data } = await getStaticSetting();
          setEnableWaterMark(data?.enableWaterMark || false);
          if (!data) {
            return {
              enableWaterMark: false,
              enableWebp: true,
            };
          }
          return data;
        }}
        syncToInitialValues={true}
        onFinish={async (data: WatermarkFormData) => {
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({ title: t('watermark.demo.restricted') });
            return false;
          }

          // 转换字符串类型的布尔值为实际的布尔值
          const processedData: WatermarkFormData = {};
          for (const [k, v] of Object.entries(data)) {
            if (v === 'false') {
              processedData[k] = false;
            } else if (v === 'true') {
              processedData[k] = true;
            } else {
              processedData[k] = v;
            }
          }

          setEnableWaterMark(processedData.enableWaterMark || false);

          if (processedData.enableWaterMark && !processedData.waterMarkText) {
            Modal.info({ title: t('watermark.text.required') });
            return false;
          }

          if (processedData.waterMarkText && !checkNoChinese(processedData.waterMarkText)) {
            Modal.info({
              title: t('watermark.text.no_chinese'),
            });
            return false;
          }

          await updateStaticSetting(processedData);
          message.success(t('watermark.update.success'));
          return true;
        }}
      >
        <ProFormSelect
          name="enableWebp"
          label={t('watermark.webp.label')}
          request={async () => {
            return [
              {
                label: t('watermark.webp.option.enabled'),
                value: true,
              },
              {
                label: t('watermark.webp.option.disabled'),
                value: false,
              },
            ];
          }}
          rules={[{ required: true, message: t('watermark.field.required') }]}
          required
          placeholder={t('watermark.webp.placeholder')}
          tooltip={t('watermark.webp.tooltip')}
        />
        <ProFormSelect
          fieldProps={{
            onChange: (target: boolean) => {
              setEnableWaterMark(target);
            },
          }}
          name="enableWaterMark"
          required
          label={t('watermark.watermark.label')}
          placeholder={t('watermark.watermark.placeholder')}
          request={async () => {
            return [
              {
                label: t('watermark.webp.option.enabled'),
                value: true,
              },
              {
                label: t('watermark.webp.option.disabled'),
                value: false,
              },
            ];
          }}
          tooltip={t('watermark.watermark.tooltip')}
          rules={[{ required: true, message: t('watermark.field.required') }]}
        ></ProFormSelect>
        {enableWaterMark && (
          <ProFormText
            name="waterMarkText"
            label={t('watermark.text.label')}
            required
            tooltip={t('watermark.text.tooltip')}
            placeholder={t('watermark.text.placeholder')}
          />
        )}
      </ProForm>
    </>
  );
}
