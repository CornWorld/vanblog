import { getStaticSetting, updateStaticSetting } from '@/services/van-blog/api';
import { checkNoChinese } from '@/services/van-blog/checkString';
import { ProForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useState } from 'react';

const trans_zh = {
  'watermark.demo.restricted': '演示站禁止修改此配置！',
  'watermark.text.required': '开启水印必须指定水印文字！',
  'watermark.text.no_chinese':
    '目前水印文字不支持中文！因为用了纯 js 库节约资源，后面会加上自定义图片作为水印。',
  'watermark.update.success': '更新成功！',
  'watermark.webp.label': '图片自动压缩',
  'watermark.webp.option.enabled': '开启',
  'watermark.webp.option.disabled': '关闭',
  'watermark.webp.placeholder': '是否开启图片自动压缩',
  'watermark.webp.tooltip':
    '开启之后上传图片将压缩至 webp 格式以提高加载速度，无论哪种存储策略都生效。',
  'watermark.field.required': '这是必填项',
  'watermark.watermark.label': '水印',
  'watermark.watermark.placeholder': '是否开启水印',
  'watermark.watermark.tooltip':
    '是否开启水印，开启之后上传图片将自动添加水印，无论哪种图床。宽高小于 128px 的图片可能会加不上水印。',
  'watermark.text.label': '水印文字',
  'watermark.text.tooltip': '此文字会作为水印加到图片右下角，目前不支持中文',
  'watermark.text.placeholder': '请输入水印文字',
};

interface WatermarkFormData {
  enableWaterMark?: boolean;
  enableWebp?: boolean;
  waterMarkText?: string;
  [key: string]: unknown;
}

export default function WaterMarkForm() {
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
            Modal.info({ title: trans_zh['watermark.demo.restricted'] });
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
            Modal.info({ title: trans_zh['watermark.text.required'] });
            return false;
          }

          if (processedData.waterMarkText && !checkNoChinese(processedData.waterMarkText)) {
            Modal.info({
              title: trans_zh['watermark.text.no_chinese'],
            });
            return false;
          }

          await updateStaticSetting(processedData);
          message.success(trans_zh['watermark.update.success']);
          return true;
        }}
      >
        <ProFormSelect
          name="enableWebp"
          label={trans_zh['watermark.webp.label']}
          request={async () => {
            return [
              {
                label: trans_zh['watermark.webp.option.enabled'],
                value: true,
              },
              {
                label: trans_zh['watermark.webp.option.disabled'],
                value: false,
              },
            ];
          }}
          rules={[{ required: true, message: trans_zh['watermark.field.required'] }]}
          required
          placeholder={trans_zh['watermark.webp.placeholder']}
          tooltip={trans_zh['watermark.webp.tooltip']}
        />
        <ProFormSelect
          fieldProps={{
            onChange: (target: boolean) => {
              setEnableWaterMark(target);
            },
          }}
          name="enableWaterMark"
          required
          label={trans_zh['watermark.watermark.label']}
          placeholder={trans_zh['watermark.watermark.placeholder']}
          request={async () => {
            return [
              {
                label: trans_zh['watermark.webp.option.enabled'],
                value: true,
              },
              {
                label: trans_zh['watermark.webp.option.disabled'],
                value: false,
              },
            ];
          }}
          tooltip={trans_zh['watermark.watermark.tooltip']}
          rules={[{ required: true, message: trans_zh['watermark.field.required'] }]}
        ></ProFormSelect>
        {enableWaterMark && (
          <ProFormText
            name="waterMarkText"
            label={trans_zh['watermark.text.label']}
            required
            tooltip={trans_zh['watermark.text.tooltip']}
            placeholder={trans_zh['watermark.text.placeholder']}
          />
        )}
      </ProForm>
    </>
  );
}
