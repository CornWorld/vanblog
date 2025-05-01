import React from 'react';
import { useTranslation } from 'react-i18next';
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
import { useModel } from '@/router';

export default function () {
  const { t } = useTranslation();
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
      message.success(t('caddy.update.success'));
      return true;
    } catch (error) {
      console.error('Failed to update HTTPS config:', error);
      message.error(t('caddy.update.error'));
      return false;
    } finally {
      setLoading(false);
    }
  };
  return (
    <Card title={t('caddy.title')}>
      <Alert
        type="info"
        message={
          <div>
            <p>
              {t('caddy.alert.info.1')}{' '}
              <a target={'_blank'} rel="noreferrer" href="https://caddyserver.com/">
                Caddy
              </a>{' '}
              {t('caddy.alert.info.2')}
              <a
                target={'_blank'}
                rel="noreferrer"
                href="https://vanblog.mereith.com/guide/https.html"
              >
                {t('caddy.alert.info.3')}
              </a>
            </p>
            <p>{t('caddy.alert.info.4')}</p>
            <p>{t('caddy.alert.info.5')}</p>
          </div>
        }
        style={{ marginBottom: 20 }}
      />
      <Alert
        type="warning"
        message={
          <div>
            <p>{t('caddy.alert.warning.1')}</p>
            <p>{t('caddy.alert.warning.2')}</p>
            <p>{t('caddy.alert.warning.3')}</p>
            <p>{t('caddy.alert.warning.4')}</p>
            <p>
              {t('caddy.alert.warning.5')}
              <a
                href="https://vanblog.mereith.com/faq/usage.html#开启了-https-重定向后关不掉"
                target="_blank"
                rel="noreferrer"
              >
                {t('caddy.alert.warning.link')}
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
                title: t('caddy.modal.demo.warning'),
              });
              setLoading(false);
              return;
            }
            const eq = isEqual(curData, data);

            if (eq) {
              Modal.warning({
                title: t('caddy.modal.unmodified.warning'),
              });
              setLoading(false);
              return;
            }
            let text = t('caddy.modal.disable.confirm');
            if (data.redirect) {
              text = t('caddy.modal.enable.confirm');
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
              submitText: t('caddy.button.save'),
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
                                title: t('caddy.modal.config.title'),
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
                            message.error(t('caddy.error.config'));
                          } finally {
                            setLoading(false);
                          }
                        }}
                        type="primary"
                      >
                        {t('caddy.button.view_config')}
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
                                title: t('caddy.modal.log.title'),
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
                            message.error(t('caddy.error.log'));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {t('caddy.button.view_log')}
                      </Button>
                      <Button
                        type="primary"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            await clearCaddyLog();
                            message.success(t('caddy.clear.success'));
                          } catch (error) {
                            console.error('Failed to clear Caddy log:', error);
                            message.error(t('caddy.error.clear'));
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {t('caddy.button.clear_log')}
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
            label={t('caddy.switch.auto_redirect')}
            tooltip={t('caddy.switch.tooltip')}
          />
        </ProForm>
      </Spin>
    </Card>
  );
}
