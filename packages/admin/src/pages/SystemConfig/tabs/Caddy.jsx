import {
  clearCaddyLog,
  getCaddyConfig,
  getCaddyLog,
  getHttpsConfig,
  setHttpsConfig,
} from '@/services/van-blog/api';
import ProForm, { ProFormSwitch } from '@ant-design/pro-form';
import { Alert, Button, Card, Input, message, Modal, Row, Space, Spin } from 'antd';
import { isEqual } from 'lodash-es';
import { useMemo, useState } from 'react';
import { useModel } from '@/utils/umiCompat';

const trans_zh = {
  'caddy.title': 'HTTPS 相关配置',
  'caddy.update.success': '更改成功！将自动刷新至新协议',
  'caddy.update.error': '更新失败！',
  'caddy.alert.info.1': 'VanBlog 是通过',
  'caddy.alert.info.2': '实现的证书全自动按需申请。',
  'caddy.alert.info.3': '相关文档',
  'caddy.alert.info.4': '高级玩家可点击按钮查看 Caddy 运行日志或配置排查错误。',
  'caddy.alert.info.5': 'access 日志可进入容器 /var/log/vanblog-access.log 查看',
  'caddy.alert.warning.1': '请确保 80/443 端口处于开放状态。',
  'caddy.alert.warning.2':
    '第一次通过某域名 https 访问时，如果没有证书会自动申请证书的。你也可以点击下面的按钮手动触发证书申请。',
  'caddy.alert.warning.3':
    '稳定后可打开 https 自动重定向功能，开启通过 http 访问将自动跳转至 https',
  'caddy.alert.warning.4':
    '如果你用了 80 端口反代，请不要开启 https 自动重定向！否则你的反代可能会失效。',
  'caddy.alert.warning.5': '如果不小心开启了此选项后关不掉，可以参考：',
  'caddy.alert.warning.link': '开启了 https 重定向后关不掉',
  'caddy.modal.demo.warning': '演示站不可修改此选项，不然怕 k8s ingress 失效',
  'caddy.modal.unmodified.warning': '未修改任何信息，无需保存！',
  'caddy.modal.disable.confirm':
    '确定关闭 https 自动重定向吗？关闭后可通过 http 进行访问。点击确定后 2 秒将自动切换到 http 访问',
  'caddy.modal.enable.confirm':
    '开启 https 自动重定向之前，请确保通过域名可正常用 https 访问本站。开启将无法使用 http 访问本站。点击确定后 2 秒将自动切换到 https 访问。注意如果是自己反代了 80 端口的话，请务必不要开启此项！',
  'caddy.button.save': '保存',
  'caddy.button.view_config': '查看 Caddy 配置',
  'caddy.button.view_log': '查看 Caddy 日志',
  'caddy.button.clear_log': '清除日志',
  'caddy.modal.config.title': 'Caddy 配置',
  'caddy.error.config': '获取 Caddy 配置错误！',
  'caddy.modal.log.title': 'Caddy 运行日志',
  'caddy.error.log': '获取 Caddy 日志错误！',
  'caddy.clear.success': '清除 Caddy 日志成功！',
  'caddy.error.clear': '清除 Caddy 日志错误！',
  'caddy.switch.auto_redirect': '开启 Https 自动重定向',
  'caddy.switch.tooltip': 'http 访问自动跳转到 https',
};

export default function () {
  const [loading, setLoading] = useState(false);
  const [curData, setCurData] = useState(null);
  const [form] = ProForm.useForm();
  const { initialState } = useModel('@@initialState');
  const cls = useMemo(() => {
    if (initialState?.settings?.navTheme != 'light') {
      return 'dark-switch';
    } else {
      return '';
    }
  }, [initialState]);
  const updateHttpsConfig = async (data) => {
    setLoading(true);
    try {
      if (data.redirect) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setTimeout(() => {
          window.location.replace(`http://${location.host}${location.pathname}`);
        }, 2000);
      }
      await setHttpsConfig(data);
      message.success(trans_zh['caddy.update.success']);
      return true;
    } catch (error) {
      console.error('Failed to update HTTPS config:', error);
      message.error(trans_zh['caddy.update.error']);
      return false;
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card title={trans_zh['caddy.title']}>
      <Alert
        type="info"
        message={
          <div>
            <p>
              {trans_zh['caddy.alert.info.1']}{' '}
              <a target={'_blank'} rel="noreferrer" href="https://caddyserver.com/">
                Caddy
              </a>{' '}
              {trans_zh['caddy.alert.info.2']}
              <a
                target={'_blank'}
                rel="noreferrer"
                href="https://vanblog.mereith.com/guide/https.html"
              >
                {trans_zh['caddy.alert.info.3']}
              </a>
            </p>
            <p>{trans_zh['caddy.alert.info.4']}</p>
            <p>{trans_zh['caddy.alert.info.5']}</p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />
      <Alert
        type="warning"
        message={
          <div>
            <p>{trans_zh['caddy.alert.warning.1']}</p>
            <p>{trans_zh['caddy.alert.warning.2']}</p>
            <p>{trans_zh['caddy.alert.warning.3']}</p>
            <p>{trans_zh['caddy.alert.warning.4']}</p>
            <p>
              {trans_zh['caddy.alert.warning.5']}
              <a
                href="https://vanblog.mereith.com/faq/usage.html#开启了-https-重定向后关不掉"
                target="_blank"
                rel="noreferrer"
              >
                {trans_zh['caddy.alert.warning.link']}
              </a>
            </p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />

      <Spin spinning={loading}>
        <ProForm
          form={form}
          request={async () => {
            setLoading(true);
            try {
              const { data: res } = await getHttpsConfig();
              setLoading(false);
              if (!res) {
                setCurData({
                  redirect: false,
                });
                return {
                  redirect: false,
                };
              }
              setCurData(res);
              return res;
            } catch (error) {
              console.error('Failed to get HTTPS config:', error);
              setLoading(false);
              message.error('Failed to get HTTPS configuration');
              return {
                redirect: false,
              };
            }
          }}
          layout="horizontal"
          onFinish={async (data) => {
            if (location.hostname == 'blog-demo.mereith.com') {
              Modal.warning({
                title: trans_zh['caddy.modal.demo.warning'],
              });
              setLoading(false);
              return;
            }
            const eq = isEqual(curData, data);

            if (eq) {
              Modal.warning({
                title: trans_zh['caddy.modal.unmodified.warning'],
              });
              setLoading(false);
              return;
            }
            let text = trans_zh['caddy.modal.disable.confirm'];
            if (data.redirect) {
              text = trans_zh['caddy.modal.enable.confirm'];
            }
            Modal.confirm({
              title: text,
              onOk: () => {
                updateHttpsConfig(data);
              },
            });
          }}
          submitter={{
            searchConfig: {
              submitText: trans_zh['caddy.button.save'],
            },
            render: (props, doms) => {
              return (
                <>
                  <Row>
                    <Space>
                      <>{doms}</>
                      <Button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const { data: res } = await getCaddyConfig();
                            if (res) {
                              Modal.info({
                                title: trans_zh['caddy.modal.config.title'],
                                content: (
                                  <Input.TextArea
                                    autoSize={{ maxRows: 20, minRows: 15 }}
                                    value={res}
                                  />
                                ),
                              });
                            }
                          } catch (error) {
                            console.error('Failed to get Caddy config:', error);
                            message.error(trans_zh['caddy.error.config']);
                          } finally {
                            setLoading(false);
                          }
                        }}
                        type="primary"
                      >
                        {trans_zh['caddy.button.view_config']}
                      </Button>
                    </Space>
                  </Row>
                  <Row style={{ marginTop: 10 }}>
                    <Space>
                      <Button
                        type="primary"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const { data: res } = await getCaddyLog();
                            if (res || res == '') {
                              Modal.info({
                                title: trans_zh['caddy.modal.log.title'],
                                content: (
                                  <Input.TextArea
                                    autoSize={{ maxRows: 20, minRows: 15 }}
                                    value={res}
                                  />
                                ),
                              });
                            }
                          } catch (error) {
                            console.error('Failed to get Caddy log:', error);
                            message.error(trans_zh['caddy.error.log']);
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {trans_zh['caddy.button.view_log']}
                      </Button>
                      <Button
                        type="primary"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await clearCaddyLog();
                            message.success(trans_zh['caddy.clear.success']);
                          } catch (error) {
                            console.error('Failed to clear Caddy log:', error);
                            message.error(trans_zh['caddy.error.clear']);
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {trans_zh['caddy.button.clear_log']}
                      </Button>
                    </Space>
                  </Row>
                </>
              );
            },
          }}
        >
          <ProFormSwitch
            className={cls}
            name="redirect"
            label={trans_zh['caddy.switch.auto_redirect']}
            tooltip={trans_zh['caddy.switch.tooltip']}
          />
        </ProForm>
      </Spin>
    </Card>
  );
}
