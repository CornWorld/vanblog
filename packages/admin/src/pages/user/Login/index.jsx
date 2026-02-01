import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Footer from '@/components/Footer';
import { login } from '@/services/van-blog/api';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input, message } from 'antd';
import { history, useModel } from '@/router';
import { setAccessToken, resetRedirectCycle } from '@/utils/auth';
import './index.less';

const Login = () => {
  const { t } = useTranslation();
  const { initialState, setInitialState } = useModel();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 页面加载时重置重定向循环检测和清理可能过期的token
  useEffect(() => {
    console.log(t('login.debug.page_loaded'));

    // 重置可能导致循环的状态
    resetRedirectCycle();

    // 清除可能存在的过期token
    const count = parseInt(sessionStorage.getItem('vanblog_redirect_count') || '0', 10);
    if (count >= 2) {
      console.log(t('login.debug.redirect_cycle'));
      localStorage.removeItem('token');
      sessionStorage.removeItem('vanblog_redirect_count');
      sessionStorage.removeItem('vanblog_redirect_timestamp');
    }
  }, [t]);

  // 处理登录表单提交
  const handleSubmit = async (values) => {
    console.log(t('login.debug.form_submitted'));

    // 再次重置重定向循环检测
    resetRedirectCycle();

    setLoading(true);

    try {
      // 发送登录请求
      const response = await login(
        {
          username: values.username,
          password: values.password,
        },
        { skipErrorHandler: true },
      );

      // ts-rest client returns { status, body } format
      if (response.status === 200 && response.body?.token) {
        // 显示成功消息
        message.success(t('login.success'));

        // 获取用户信息和令牌
        const token = response.body.token;
        const apiUser = response.body.user;

        const user = apiUser
          ? {
              name: apiUser.username,
              id: apiUser.id,
              type: apiUser.type,
            }
          : null;

        if (!user) {
          console.error(t('login.debug.missing_user'));
          message.error(t('login.missing_user_data'));
          return;
        }

        // 保存令牌
        console.log(t('login.debug.saving_token'));
        setAccessToken(token);

        // 更新应用状态
        await setInitialState((s) => ({
          ...s,
          token: token,
          user: user,
        }));

        // 获取初始化数据
        console.log(t('login.debug.fetching_data'));
        try {
          const meta = await initialState?.fetchInitData();

          if (meta) {
            console.log(t('login.debug.updated_state'));
            await setInitialState((s) => ({
              ...s,
              token: token,
              user: user,
              ...meta,
            }));
          }
        } catch (metaError) {
          console.error(t('login.debug.meta_error'), metaError);
        }

        // 处理重定向
        console.log(t('login.debug.handling_redirect'));
        if (!history) {
          console.error(t('login.debug.no_history'));
          window.location.href = '/admin/';
          return;
        }

        try {
          const { query } = history.location;
          const { redirect } = query || {};
          const targetPath = redirect || '/';

          console.log(t('login.debug.redirecting') + targetPath);
          history.push(targetPath);
        } catch (navError) {
          console.error(t('login.debug.nav_error'), navError);
          window.location.href = '/admin/';
        }

        return;
      } else if (response.status === 401) {
        console.log(t('login.debug.failed_401'));
        message.error(t('login.username_password_error'));
      } else {
        console.log(t('login.debug.failed_status') + response.status);
        message.error(response.body?.message || t('login.failed'));
      }
    } catch (error) {
      console.error(t('login.debug.error'), error);

      if (error.response?.status === 401) {
        console.log(t('login.debug.caught_401'));
        message.error(t('login.username_password_error'));
      } else if (error.message) {
        message.error(t('login.failed_with_msg') + error.message);
      } else {
        message.error(t('login.network_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="content">
        <div className="loginForm">
          <div className="loginLogo">
            <img alt="logo" src="/logo.svg" />
          </div>
          <h2>{t('login.title')}</h2>
          <p className="subtitle">{t('login.subtitle')}</p>

          <Form
            form={form}
            name="login"
            initialValues={{ autoLogin: true }}
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: t('login.username_required') }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined className={'prefixIcon'} />}
                placeholder={t('login.username_placeholder')}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('login.password_required') }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined className={'prefixIcon'} />}
                placeholder={t('login.password_placeholder')}
              />
            </Form.Item>

            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
              <Form.Item name="autoLogin" valuePropName="checked" noStyle>
                <Checkbox>{t('login.remember')}</Checkbox>
              </Form.Item>
              <a
                onClick={(e) => {
                  e.preventDefault();
                  history.push('/user/restore');
                }}
              >
                {t('login.forgot_password')}
              </a>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
              >
                {t('login.submit')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
