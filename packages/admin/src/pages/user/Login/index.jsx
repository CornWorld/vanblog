import Footer from '@/components/Footer';
import { login } from '@/services/van-blog/api';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormCheckbox, ProFormText } from '@ant-design/pro-form';
import { message } from 'antd';
import { history, useModel } from '@/router';
import { setAccessToken, resetRedirectCycle } from '@/utils/auth';
import './index.less';
import { useEffect } from 'react';

const trans_zh = {
  'login.debug.page_loaded': '[DEBUG] Login page loaded',
  'login.debug.redirect_cycle': '[DEBUG] Potential redirect cycle detected, removing token',
  'login.debug.form_submitted': '[DEBUG] Login form submitted',
  'login.debug.missing_user': '[DEBUG] Login response missing user data',
  'login.debug.saving_token': '[DEBUG] Saving token and user data',
  'login.debug.fetching_data': '[DEBUG] Fetching initial data',
  'login.debug.updated_state': '[DEBUG] Updated app state with meta data',
  'login.debug.meta_error': '[DEBUG] Error fetching meta data:',
  'login.debug.handling_redirect': '[DEBUG] Handling redirect after login',
  'login.debug.no_history': '[DEBUG] History object not available',
  'login.debug.redirecting': '[DEBUG] Redirecting to:',
  'login.debug.nav_error': '[DEBUG] Navigation error:',
  'login.debug.failed_401': '[DEBUG] Login failed with 401',
  'login.debug.failed_status': '[DEBUG] Login failed with status:',
  'login.debug.error': '[DEBUG] Login error:',
  'login.debug.caught_401': '[DEBUG] Caught 401 error @auth.controller.ts @auth.provider.ts',
  'login.debug.form_error': '[DEBUG] Error in form processing:',

  'login.logging_in': '登录中...',
  'login.success': '登录成功！',
  'login.missing_user_data': '登录响应缺少用户信息',
  'login.username_password_error': '用户名或密码错误',
  'login.failed': '登录失败，请稍后再试',
  'login.failed_with_msg': '登录失败: ',
  'login.network_error': '登录请求失败，请检查网络连接',
  'login.form_error': '表单处理出错，请重试',

  'login.title': 'VanBlog',
  'login.subtitle': 'VanBlog 博客管理后台',
  'login.username_placeholder': '管理员账号',
  'login.username_required': '请输入管理员账号',
  'login.password_placeholder': '管理员密码',
  'login.password_required': '请输入管理员密码',
  'login.remember': '自动登录',
  'login.submit': '登录',
  'login.forgot_password': '忘记密码 ?',
};

const Login = () => {
  const type = 'account';
  const { initialState, setInitialState } = useModel();

  // 页面加载时重置重定向循环检测和清理可能过期的token
  useEffect(() => {
    console.log(trans_zh['login.debug.page_loaded']);

    // 重置可能导致循环的状态
    resetRedirectCycle();

    // 清除可能存在的过期token
    // 注意：仅在处于redirect循环时清除token，避免正常登录流程被干扰
    const count = parseInt(sessionStorage.getItem('vanblog_redirect_count') || '0', 10);
    if (count >= 2) {
      console.log(trans_zh['login.debug.redirect_cycle']);
      localStorage.removeItem('token');
      sessionStorage.removeItem('vanblog_redirect_count');
      sessionStorage.removeItem('vanblog_redirect_timestamp');
    }
  }, []);

  // 处理登录表单提交
  const handleSubmit = async (values) => {
    console.log(trans_zh['login.debug.form_submitted']);

    // 再次重置重定向循环检测
    resetRedirectCycle();

    try {
      // 显示加载消息
      message.loading(trans_zh['login.logging_in'], 0.5);
      // 发送登录请求
      const msg = await login(
        {
          username: values.username,
          password: values.password,
        },
        { skipErrorHandler: true },
      ); // 跳过默认错误处理

      // 处理成功响应
      if (msg.statusCode === 200 && msg.data?.token) {
        // 显示成功消息
        message.success(trans_zh['login.success']);

        // 获取用户信息和令牌
        const token = msg.data.token;
        const user = msg.data.user
          ? {
              name: msg.data.user.name,
              id: msg.data.user.id,
              type: msg.data.user.type,
            }
          : null;

        if (!user) {
          console.error(trans_zh['login.debug.missing_user']);
          message.error(trans_zh['login.missing_user_data']);
          return;
        }

        // 保存令牌
        console.log(trans_zh['login.debug.saving_token']);
        setAccessToken(token);

        // 更新应用状态
        await setInitialState((s) => ({
          ...s,
          token: token,
          user: user,
        }));

        // 获取初始化数据
        console.log(trans_zh['login.debug.fetching_data']);
        try {
          const meta = await initialState?.fetchInitData();

          if (meta) {
            console.log(trans_zh['login.debug.updated_state']);
            await setInitialState((s) => ({
              ...s,
              token: token,
              user: user,
              ...meta,
            }));
          }
        } catch (metaError) {
          console.error(trans_zh['login.debug.meta_error'], metaError);
          // 继续处理，即使获取元数据失败
        }

        // 处理重定向
        console.log(trans_zh['login.debug.handling_redirect']);
        // 检查history对象
        if (!history) {
          console.error(trans_zh['login.debug.no_history']);
          window.location.href = '/admin/';
          return;
        }

        try {
          // 获取查询参数中的重定向URL
          const { query } = history.location;
          const { redirect } = query || {};
          const targetPath = redirect || '/';

          console.log(trans_zh['login.debug.redirecting'] + targetPath);
          history.push(targetPath);
        } catch (navError) {
          console.error(trans_zh['login.debug.nav_error'], navError);
          // 如果路由跳转失败，使用直接URL导航
          window.location.href = '/admin/';
        }

        return;
      } else if (msg.statusCode === 401 || msg.response?.status === 401) {
        // 处理认证失败
        console.log(trans_zh['login.debug.failed_401']);
        message.error(msg.message || trans_zh['login.username_password_error']);
      } else {
        // 处理其他错误
        console.log(
          trans_zh['login.debug.failed_status'] + (msg.statusCode || msg.response?.status),
        );
        message.error(msg.message || trans_zh['login.failed']);
      }
    } catch (error) {
      // 处理请求异常
      console.error(trans_zh['login.debug.error'], error);

      if (error.response?.status === 401) {
        console.log(trans_zh['login.debug.caught_401']);
        message.error(trans_zh['login.username_password_error']);
      } else if (error.message) {
        message.error(trans_zh['login.failed_with_msg'] + error.message);
      } else {
        message.error(trans_zh['login.network_error']);
      }
    }
  };

  return (
    <div className="container">
      <div className="content">
        <LoginForm
          className="loginForm"
          logo={<img alt="logo" src="/logo.svg" />}
          title={trans_zh['login.title']}
          subTitle={trans_zh['login.subtitle']}
          initialValues={{
            autoLogin: true,
          }}
          onFinish={async (values) => {
            try {
              await handleSubmit({
                username: values.username,
                password: values.password,
              });
            } catch (error) {
              console.error(trans_zh['login.debug.form_error'], error);
              message.error(trans_zh['login.form_error']);
            }
          }}
        >
          {type === 'account' && (
            <>
              <ProFormText
                name="username"
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined className={'prefixIcon'} />,
                }}
                placeholder={trans_zh['login.username_placeholder']}
                rules={[
                  {
                    required: true,
                    message: trans_zh['login.username_required'],
                  },
                ]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined className={'prefixIcon'} />,
                }}
                placeholder={trans_zh['login.password_placeholder']}
                rules={[
                  {
                    required: true,
                    message: trans_zh['login.password_required'],
                  },
                ]}
              />
            </>
          )}
          <div
            style={{
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <ProFormCheckbox noStyle name="autoLogin">
              {trans_zh['login.remember']}
            </ProFormCheckbox>
            <a
              onClick={() => {
                history.push('/user/restore');
              }}
            >
              {trans_zh['login.forgot_password']}
            </a>
          </div>
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
