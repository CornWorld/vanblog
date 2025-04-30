import { getStaticSetting, updateStaticSetting } from '@/services/van-blog/api';
import { ProForm, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { message, Modal } from 'antd';
import { useState } from 'react';

const trans_zh = {
  'static_form.storage_type.label': '存储策略',
  'static_form.storage_type.placeholder': '请选择存储策略',
  'static_form.storage_type.local': '本地存储',
  'static_form.storage_type.picgo': 'OSS 图床',
  'static_form.storage_type.tooltip': '本地存储之前请确保映射了永久目录以防丢失哦',
  'static_form.required': '这是必填项',
  'static_form.picgo_config.label': 'picgo 配置',
  'static_form.picgo_config.placeholder': '请输入 picgo 配置 (json)',
  'static_form.picgo_config.error': 'picgoConfig 格式错误，无法解析成 json',
  'static_form.plugins.label': '自定义 picgo 插件',
  'static_form.plugins.placeholder': '看不懂的话请忽略',
  'static_form.plugins.tooltip': '请填写插件名（如 s3），多个请用英文逗号分隔',
  'static_form.update.success': '更新成功！',
  'static_form.demo.title': '演示站禁止修改图床配置！',
};

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
            Modal.info({ title: trans_zh['static_form.demo.title'] });
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
              message.error(trans_zh['static_form.picgo_config.error']);
              return false;
            }
          }
          await updateStaticSetting(toUpload);
          message.success(trans_zh['static_form.update.success']);
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
          label={trans_zh['static_form.storage_type.label']}
          placeholder={trans_zh['static_form.storage_type.placeholder']}
          valueEnum={{
            local: trans_zh['static_form.storage_type.local'],
            picgo: trans_zh['static_form.storage_type.picgo'],
          }}
          tooltip={trans_zh['static_form.storage_type.tooltip']}
          rules={[{ required: true, message: trans_zh['static_form.required'] }]}
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
                  {trans_zh['static_form.picgo_config.label']}
                </a>
              }
              tooltip={'OSS 图床后端采用了 picgo'}
              placeholder={trans_zh['static_form.picgo_config.placeholder']}
              fieldProps={{
                autoSize: {
                  minRows: 10,
                  maxRows: 30,
                },
              }}
            />
            <ProFormText
              name="picgoPlugins"
              label={trans_zh['static_form.plugins.label']}
              tooltip={trans_zh['static_form.plugins.tooltip']}
              placeholder={trans_zh['static_form.plugins.placeholder']}
            />
          </>
        )}
      </ProForm>
    </>
  );
}
