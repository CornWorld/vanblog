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

const trans_zh = {
  'demo.restricted': '演示站禁止修改 waline 配置！',
  'json.invalid': '自定义环境变量不是合法 JSON 格式！',
  'update.success': '更新成功！',
  'webhook.label': '评论后的 webhook 地址',
  'webhook.tooltip': '收到评论后会向此地址发送一条携带评论信息的 HTTP 请求',
  'webhook.placeholder': '评论后的 webhook 地址',
  'login.option.enabled': '开启',
  'login.option.disabled': '关闭',
  'login.label': '是否强制登录后评论',
  'login.placeholder': '是否强制登录后评论，默认关闭',
  'email.label': '是否启用邮件通知',
  'email.tooltip': '启用后新评论会通知博主，被回复时会通知填写邮箱的被回复者',
  'email.placeholder': '默认关闭',
  'smtp.host.label': 'SMTP 地址(host)',
  'smtp.host.tooltip': '发送邮件使用的 smtp 地址',
  'smtp.host.placeholder': '请输入发送邮件使用的 smtp 地址',
  'smtp.port.label': 'SMTP 端口号',
  'smtp.port.tooltip': '发送邮件使用的 smtp 端口号',
  'smtp.port.placeholder': '请输入发送邮件使用的 smtp 端口号',
  'smtp.user.label': 'SMTP 用户名',
  'smtp.user.tooltip': '发送邮件使用的 smtp 用户名',
  'smtp.user.placeholder': '请输入发送邮件使用的 smtp 用户名',
  'smtp.password.label': 'SMTP 密码',
  'smtp.password.tooltip': '发送邮件使用的 smtp 密码',
  'smtp.password.placeholder': '请输入发送邮件使用的 smtp 密码',
  'author.email.label': '博主邮箱',
  'author.email.tooltip': '用来通知博主有新评论',
  'author.email.placeholder': '用来通知博主有新评论',
  'sender.name.label': '自定义发送邮件的发件人',
  'sender.name.tooltip': '自定义发送邮件的发件人',
  'sender.name.placeholder': '自定义发送邮件的发件人',
  'sender.email.label': '自定义发送邮件的发件地址',
  'sender.email.tooltip': '自定义发送邮件的发件地址',
  'sender.email.placeholder': '自定义发送邮件的发件地址',
  'other.config.label': '自定义环境变量',
  'other.config.tooltip': 'json 格式的键值对，会传递个 waline 作为环境变量',
  'other.config.placeholder': 'json 格式的键值对，会传递个 waline 作为环境变量',
  'field.required': '这是必填项',
};

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
            Modal.info({ title: trans_zh['demo.restricted'] });
            return;
          }
          if (data.otherConfig) {
            try {
              JSON.parse(data.otherConfig);
            } catch (err) {
              console.error('JSON parse error:', err);
              Modal.info({ title: trans_zh['json.invalid'] });
              return;
            }
          }
          setEnableEmail(data?.['smtp.enabled'] || false);
          try {
            await updateWalineConfig(data);
            message.success(trans_zh['update.success']);
          } catch (err) {
            console.error('Failed to update Waline config:', err);
            message.error('更新失败！');
          }
        }}
      >
        <ProFormText
          name="webhook"
          label={trans_zh['webhook.label']}
          tooltip={trans_zh['webhook.tooltip']}
          placeholder={trans_zh['webhook.placeholder']}
        />
        <ProFormSelect
          fieldProps={{
            options: [
              {
                label: trans_zh['login.option.enabled'],
                value: true,
              },
              {
                label: trans_zh['login.option.disabled'],
                value: false,
              },
            ],
          }}
          name="forceLoginComment"
          label={trans_zh['login.label']}
          placeholder={trans_zh['login.placeholder']}
        ></ProFormSelect>
        <ProFormSelect
          fieldProps={{
            onChange: (target: boolean) => {
              setEnableEmail(target);
            },
            options: [
              {
                label: trans_zh['login.option.enabled'],
                value: true,
              },
              {
                label: trans_zh['login.option.disabled'],
                value: false,
              },
            ],
          }}
          name="smtp.enabled"
          label={trans_zh['email.label']}
          tooltip={trans_zh['email.tooltip']}
          placeholder={trans_zh['email.placeholder']}
        ></ProFormSelect>
        {enableEmail && (
          <>
            <ProFormText
              name="smtp.host"
              label={trans_zh['smtp.host.label']}
              tooltip={trans_zh['smtp.host.tooltip']}
              placeholder={trans_zh['smtp.host.placeholder']}
              rules={[{ required: true, message: trans_zh['field.required'] }]}
            />
            <ProFormDigit
              name="smtp.port"
              label={trans_zh['smtp.port.label']}
              tooltip={trans_zh['smtp.port.tooltip']}
              placeholder={trans_zh['smtp.port.placeholder']}
              rules={[{ required: true, message: trans_zh['field.required'] }]}
            />
            <ProFormText
              name="smtp.user"
              label={trans_zh['smtp.user.label']}
              tooltip={trans_zh['smtp.user.tooltip']}
              placeholder={trans_zh['smtp.user.placeholder']}
              rules={[{ required: true, message: trans_zh['field.required'] }]}
            />
            <ProFormText.Password
              name="smtp.password"
              label={trans_zh['smtp.password.label']}
              tooltip={trans_zh['smtp.password.tooltip']}
              placeholder={trans_zh['smtp.password.placeholder']}
              rules={[{ required: true, message: trans_zh['field.required'] }]}
            />
            <ProFormText
              name="authorEmail"
              label={trans_zh['author.email.label']}
              tooltip={trans_zh['author.email.tooltip']}
              placeholder={trans_zh['author.email.placeholder']}
              rules={[{ required: true, message: trans_zh['field.required'] }]}
            />
            <ProFormText
              name="sender.name"
              label={trans_zh['sender.name.label']}
              tooltip={trans_zh['sender.name.tooltip']}
              placeholder={trans_zh['sender.name.placeholder']}
            />
            <ProFormText
              name="sender.email"
              label={trans_zh['sender.email.label']}
              tooltip={trans_zh['sender.email.tooltip']}
              placeholder={trans_zh['sender.email.placeholder']}
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
              {trans_zh['other.config.label']}
            </a>
          }
          tooltip={trans_zh['other.config.tooltip']}
          placeholder={trans_zh['other.config.placeholder']}
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
