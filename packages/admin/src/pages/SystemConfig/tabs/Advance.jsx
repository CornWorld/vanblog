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

const trans_zh = {
  'advance.login.card.title': '登录安全策略',
  'advance.login.alert.warning':
    '开启最大登录失败次数限制目前还不稳定！暂时先不可配置，稳定后开放。',
  'advance.login.form.max_retry.label': '开启最大登录失败次数限制',
  'advance.login.form.max_retry.option.enabled': '开启',
  'advance.login.form.max_retry.option.disabled': '关闭',
  'advance.login.form.max_retry.placeholder': '关闭',
  'advance.login.form.max_retry.tooltip':
    '默认关闭，开启后同一 ip 登录失败次数过多后需等一分钟后才能再次登录',
  'advance.login.form.expires.label': '登录凭证(Token)有效期(秒)',
  'advance.login.form.expires.placeholder': '默认为 7 天',
  'advance.login.form.expires.tooltip': '默认为 7 天',
  'advance.login.modal.demo': '演示站禁止修改登录安全策略！',
  'advance.login.message.success': '更新成功！',
  'advance.isr.card.title': '静态页面更新策略',
  'advance.isr.help.link': '帮助文档',
  'advance.isr.form.mode.label': '静态页面更新策略',
  'advance.isr.form.mode.option.delay': '延时自动',
  'advance.isr.form.mode.option.on_demand': '按需自动',
  'advance.isr.form.mode.tooltip':
    '默认为延时自动，使用按需自动可提高实时性，但需要更多性能（4核心以上推荐）',
  'advance.isr.form.delay.label': '延时自动更新时间(秒)',
  'advance.isr.form.delay.tooltip':
    '默认为 10 秒。表示每 10 秒，博客前台服务会尝试根据最新的后端数据来更新静态页面。',
  'advance.isr.modal.demo': '演示站禁止修改静态页面更新策略！',
  'advance.isr.message.success': '更新成功！',
  'advance.isr_manual.card.title': '手动触发静态页面更新',
  'advance.isr_manual.alert.info':
    '通常来说你不需要这样做，但某些情况下你也可以手动触发增量渲染。这会让后端尝试重新验证/渲染已知所有路由（触发完成后需要一些时间生效）。',
  'advance.isr_manual.button': '手动触发',
  'advance.isr_manual.message.success': 'ISR 手动触发成功！',
  'advance.isr_manual.message.error': 'ISR 触发失败！',
};

export default function () {
  const [isrLoading, setIsrLoading] = useState(false);
  return (
    <>
      <Card title={trans_zh['advance.login.card.title']}>
        <Alert
          type="warning"
          message={trans_zh['advance.login.alert.warning']}
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
              Modal.info({ title: trans_zh['advance.login.modal.demo'] });
              return;
            }
            await updateLoginConfig(data);
            message.success(trans_zh['advance.login.message.success']);
          }}
        >
          <ProFormSelect
            disabled={true}
            name={'enableMaxLoginRetry'}
            label={trans_zh['advance.login.form.max_retry.label']}
            fieldProps={{
              options: [
                {
                  label: trans_zh['advance.login.form.max_retry.option.enabled'],
                  value: true,
                },
                {
                  label: trans_zh['advance.login.form.max_retry.option.disabled'],
                  value: false,
                },
              ],
            }}
            placeholder={trans_zh['advance.login.form.max_retry.placeholder']}
            tooltip={trans_zh['advance.login.form.max_retry.tooltip']}
          ></ProFormSelect>
          <ProFormDigit
            name={'expiresIn'}
            label={trans_zh['advance.login.form.expires.label']}
            placeholder={trans_zh['advance.login.form.expires.placeholder']}
            tooltip={trans_zh['advance.login.form.expires.tooltip']}
          />
        </ProForm>
      </Card>

      <Card title={trans_zh['advance.isr.card.title']} style={{ marginTop: 8 }}>
        <Alert
          type="info"
          message={
            <a
              rel="noreferrer"
              target="_blank"
              href="https://vanblog.mereith.com/feature/advance/isr.html"
            >
              {trans_zh['advance.isr.help.link']}
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
              Modal.info({ title: trans_zh['advance.isr.modal.demo'] });
              return;
            }
            await updateISRConfig(data);
            message.success(trans_zh['advance.isr.message.success']);
          }}
        >
          <ProFormSelect
            name={'mode'}
            label={trans_zh['advance.isr.form.mode.label']}
            fieldProps={{
              options: [
                {
                  label: trans_zh['advance.isr.form.mode.option.delay'],
                  value: 'delay',
                },
                {
                  label: trans_zh['advance.isr.form.mode.option.on_demand'],
                  value: 'onDemand',
                },
              ],
            }}
            tooltip={trans_zh['advance.isr.form.mode.tooltip']}
          ></ProFormSelect>
          <ProFormDigit
            name={'delay'}
            label={trans_zh['advance.isr.form.delay.label']}
            tooltip={trans_zh['advance.isr.form.delay.tooltip']}
          />
        </ProForm>
      </Card>
      <Card title={trans_zh['advance.isr_manual.card.title']} style={{ marginTop: 8 }}>
        <Alert
          type="info"
          message={trans_zh['advance.isr_manual.alert.info']}
          style={{ marginBottom: 8 }}
        />
        <Button
          type="primary"
          onClick={async () => {
            setIsrLoading(true);
            try {
              await activeISR();
              message.success(trans_zh['advance.isr_manual.message.success']);
            } catch (error) {
              console.error('ISR activation error:', error);
              message.error(trans_zh['advance.isr_manual.message.error']);
            }
            setIsrLoading(false);
          }}
          loading={isrLoading}
        >
          {trans_zh['advance.isr_manual.button']}
        </Button>
      </Card>
    </>
  );
}
