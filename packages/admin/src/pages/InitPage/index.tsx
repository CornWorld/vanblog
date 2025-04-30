import { message, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ProFormText, StepsForm, ProFormInstance } from '@ant-design/pro-components';
import { useEffect, useRef } from 'react';
import { resetRedirectCycle } from '@/utils/auth';
import { fetchAllMeta } from '@/services/van-blog/api';
import './index.less';

const trans_zh = {
  'init.message.required': '此项为必填项',
};

interface ApiError {
  response?: {
    status?: number;
  };
  data?: {
    statusCode?: number;
    message?: string;
  };
  message?: string;
}

interface InitFormValues {
  name: string;
  password: string;
  author: string;
  authorLogo: string;
  authorLogoDark: string;
  authorDesc: string;
  siteLogo: string;
  siteLogoDark: string;
  favicon: string;
  siteName: string;
  siteDesc: string;
  baseUrl: string;
  beianNumber?: string;
  beianUrl?: string;
}

const InitPage = () => {
  const navigate = useNavigate();
  const formMapRef = useRef<React.MutableRefObject<ProFormInstance<InitFormValues> | undefined>[]>(
    [],
  );
  const formRef1 = useRef<ProFormInstance<InitFormValues>>(null);
  const formRef2 = useRef<ProFormInstance<InitFormValues>>(null);
  const formRef3 = useRef<ProFormInstance<InitFormValues>>(null);

  // 页面加载时清除重定向循环状态和任何残留令牌
  useEffect(() => {
    resetRedirectCycle();
  }, []);

  useEffect(() => {
    const checkInit = async () => {
      try {
        const { statusCode } = await fetchAllMeta();
        if (statusCode === 200) {
          navigate('/', { replace: true });
        }
      } catch (error) {
        const err = error as ApiError;
        console.error('Error checking init status:', err);

        // 详细记录错误信息以便调试
        if (err.response?.status) {
          console.error('HTTP Status:', err.response.status);
        }
        if (err.data?.message) {
          console.error('Error Message:', err.data.message);
        }
        if (err.message) {
          console.error('Raw Error:', err.message);
        }
      }
    };
    checkInit();
  }, [navigate]);

  const handleInitSubmit = async (values: InitFormValues) => {
    try {
      const response = await fetch('/api/admin/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (response.ok && data?.statusCode === 200) {
        message.success('初始化成功！');
        navigate('/user/login', { replace: true });
      } else {
        message.error(data?.message || '初始化失败！');
      }
    } catch (error) {
      const err = error as ApiError;
      console.error('Error during initialization:', err);
      message.error(err.data?.message || err.message || '初始化失败！');
    }
  };

  return (
    <div className="init-page">
      <Alert
        message="系统初始化"
        description="欢迎使用 VanBlog，让我们开始初始化系统吧！"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <StepsForm
        formMapRef={formMapRef}
        onFinish={handleInitSubmit}
        formProps={{
          validateMessages: {
            required: trans_zh['init.message.required'],
          },
        }}
      >
        <StepsForm.StepForm<InitFormValues>
          formRef={formRef1}
          title="设置管理员账号"
          onFinish={async () => {
            return true;
          }}
        >
          <ProFormText name="name" label="用户名" width="md" rules={[{ required: true }]} />
          <ProFormText.Password
            name="password"
            label="密码"
            width="md"
            rules={[{ required: true }]}
          />
        </StepsForm.StepForm>

        <StepsForm.StepForm<InitFormValues>
          formRef={formRef2}
          title="设置作者信息"
          onFinish={async () => {
            return true;
          }}
        >
          <ProFormText name="author" label="作者名" width="md" rules={[{ required: true }]} />
          <ProFormText name="authorLogo" label="作者头像" width="md" rules={[{ required: true }]} />
          <ProFormText name="authorLogoDark" label="作者头像（暗色）" width="md" />
          <ProFormText name="authorDesc" label="作者简介" width="md" rules={[{ required: true }]} />
        </StepsForm.StepForm>

        <StepsForm.StepForm<InitFormValues>
          formRef={formRef3}
          title="设置站点信息"
          onFinish={async () => {
            return true;
          }}
        >
          <ProFormText name="siteName" label="站点名称" width="md" rules={[{ required: true }]} />
          <ProFormText name="siteDesc" label="站点描述" width="md" rules={[{ required: true }]} />
          <ProFormText name="siteLogo" label="站点 Logo" width="md" rules={[{ required: true }]} />
          <ProFormText name="siteLogoDark" label="站点 Logo（暗色）" width="md" />
          <ProFormText name="favicon" label="站点图标" width="md" rules={[{ required: true }]} />
          <ProFormText name="baseUrl" label="站点 URL" width="md" rules={[{ required: true }]} />
          <ProFormText name="beianNumber" label="备案号" width="md" />
          <ProFormText name="beianUrl" label="备案链接" width="md" />
        </StepsForm.StepForm>
      </StepsForm>
    </div>
  );
};

export default InitPage;
