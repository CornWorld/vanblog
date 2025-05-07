import React from 'react';
import { useTranslation } from 'react-i18next';
import { message, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ProFormText, StepsForm, ProFormInstance, ProFormSelect, ProFormDateTimePicker } from '@ant-design/pro-components';
import { useEffect, useRef } from 'react';
import { resetRedirectCycle } from '@/utils/auth';
import { fetchAllMeta } from '@/services/van-blog/api';
import './index.less';
import { encryptPwd } from '@/services/van-blog/encryptPwd';

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
  nickname: string;
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
  gaBeianNumber?: string;
  gaBeianUrl?: string;
  gaBeianLogoUrl?: string;
  payAliPay?: string;
  payWechat?: string;
  payAliPayDark?: string;
  payWechatDark?: string;
  since?: Date;
  gaAnalysisId?: string;
  baiduAnalysisId?: string;
  copyrightAggreement?: string;
  enableComment?: 'true' | 'false';
  showSubMenu?: 'true' | 'false';
  headerLeftContent?: 'siteLogo' | 'siteName';
  subMenuOffset?: number;
  showAdminButton?: 'true' | 'false';
  showDonateInfo?: 'true' | 'false';
  showFriends?: 'true' | 'false';
  showCopyRight?: 'true' | 'false';
  showDonateButton?: 'true' | 'false';
  showDonateInAbout?: 'true' | 'false';
  allowOpenHiddenPostByUrl?: 'true' | 'false';
  defaultTheme?: 'auto' | 'dark' | 'light';
  enableCustomizing?: 'true' | 'false';
  showRSS?: 'true' | 'false';
  openArticleLinksInNewWindow?: 'true' | 'false';
  showExpirationReminder?: 'true' | 'false';
  showEditButton?: 'true' | 'false';
}

const InitPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const formMapRef = useRef<React.MutableRefObject<ProFormInstance<InitFormValues> | undefined>[]>([]);
  const formRef1 = useRef<ProFormInstance<InitFormValues>>(null);
  const formRef2 = useRef<ProFormInstance<InitFormValues>>(null);
  const formRef3 = useRef<ProFormInstance<InitFormValues>>(null);
  const formRef4 = useRef<ProFormInstance<InitFormValues>>(null);

  useEffect(() => {
    resetRedirectCycle();
  }, []);

  useEffect(() => {
    const checkInit = async () => {
      try {
        const response = await fetchAllMeta();
        if (response && 'statusCode' in response) {
          if (response.statusCode === 200) {
            navigate('/', { replace: true });
          }
        }
      } catch (error) {
        const err = error as ApiError;
        console.error('Error checking init status:', err);

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
      // Prepare the request body according to the required format
      const requestBody = {
        user: {
          username: values.name,
          password: encryptPwd(values.name, values.password),
          nickname: values.name // Using name as nickname if not provided
        },
        siteInfo: {
          author: values.author,
          authorLogo: values.authorLogo,
          authorLogoDark: values.authorLogoDark,
          authDesc: values.authorDesc, // Note: API expects authDesc, not authorDesc
          siteLogo: values.siteLogo,
          siteLogoDark: values.siteLogoDark,
          favicon: values.favicon,
          siteName: values.siteName,
          siteDesc: values.siteDesc,
          baseUrl: values.baseUrl,
          beianNumber: values.beianNumber || '',
          beianUrl: values.beianUrl || '',
          gaBeianNumber: values.gaBeianNumber || '',
          gaBeianUrl: values.gaBeianUrl || '',
          gaBeianLogoUrl: values.gaBeianLogoUrl || '',
          payAliPay: values.payAliPay || '',
          payWechat: values.payWechat || '',
          payAliPayDark: values.payAliPayDark || '',
          payWechatDark: values.payWechatDark || '',
          since: values.since || new Date(),
          gaAnalysisId: values.gaAnalysisId || '',
          baiduAnalysisId: values.baiduAnalysisId || '',
          copyrightAggreement: values.copyrightAggreement || '',
          enableComment: values.enableComment || 'true',
          showSubMenu: values.showSubMenu || 'false',
          headerLeftContent: values.headerLeftContent || 'siteName',
          subMenuOffset: values.subMenuOffset || 0,
          showAdminButton: values.showAdminButton || 'true',
          showDonateInfo: values.showDonateInfo || 'true',
          showFriends: values.showFriends || 'true',
          showCopyRight: values.showCopyRight || 'true',
          showDonateButton: values.showDonateButton || 'true',
          showDonateInAbout: values.showDonateInAbout || 'false',
          allowOpenHiddenPostByUrl: values.allowOpenHiddenPostByUrl || 'false',
          defaultTheme: values.defaultTheme || 'auto',
          enableCustomizing: values.enableCustomizing || 'true',
          showRSS: values.showRSS || 'true',
          openArticleLinksInNewWindow: values.openArticleLinksInNewWindow || 'false',
          showExpirationReminder: values.showExpirationReminder || 'true',
          showEditButton: values.showEditButton || 'true'
        }
      };

      const response = await fetch('/api/admin/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
            required: t('init.message.required'),
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
          <ProFormText
            name="name"
            label={t('user.username')}
            width="md"
            rules={[{ required: true }]}
          />
          <ProFormText.Password
            name="password"
            label={t('category.form.password')}
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
          <ProFormText name="gaBeianNumber" label="公安备案号" width="md" />
          <ProFormText name="gaBeianUrl" label="公安备案链接" width="md" />
          <ProFormText name="gaBeianLogoUrl" label="公安备案 Logo" width="md" />
          <ProFormText name="gaAnalysisId" label="Google Analytics ID" width="md" />
          <ProFormText name="baiduAnalysisId" label="百度统计 ID" width="md" />
          <ProFormText name="copyrightAggreement" label="版权协议" width="md" />
          <ProFormDateTimePicker name="since" label="建站时间" width="md" />
        </StepsForm.StepForm>

        <StepsForm.StepForm<InitFormValues>
          formRef={formRef4}
          title="设置布局选项"
          onFinish={async () => {
            return true;
          }}
          initialValues={{
            enableComment: 'true',
            showSubMenu: 'false',
            headerLeftContent: 'siteName',
            defaultTheme: 'auto',
            showAdminButton: 'true',
            showDonateInfo: 'true',
            showFriends: 'true',
            showCopyRight: 'true',
            showDonateButton: 'true',
            showDonateInAbout: 'false',
            allowOpenHiddenPostByUrl: 'false',
            enableCustomizing: 'true',
            showRSS: 'true',
            openArticleLinksInNewWindow: 'false',
            showExpirationReminder: 'true',
            showEditButton: 'true',
            subMenuOffset: 0,
          }}
        >
          <ProFormSelect
            name="enableComment"
            label="是否开启评论"
            width="md"
            valueEnum={{
              'true': '开启',
              'false': '关闭',
            }}
          />
          <ProFormSelect
            name="showSubMenu"
            label="显示分类导航栏"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="headerLeftContent"
            label="导航栏左侧内容"
            width="md"
            valueEnum={{
              'siteLogo': '网站 Logo',
              'siteName': '网站名称',
            }}
          />
          <ProFormSelect
            name="defaultTheme"
            label="默认主题"
            width="md"
            valueEnum={{
              'auto': '自动',
              'light': '亮色',
              'dark': '暗色',
            }}
          />
          <ProFormSelect
            name="showAdminButton"
            label="显示后台按钮"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="showDonateInfo"
            label="显示捐赠信息"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="showFriends"
            label="显示友链"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="showCopyRight"
            label="显示版权信息"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="showDonateButton"
            label="显示打赏按钮"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="showDonateInAbout"
            label="关于页显示打赏"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="allowOpenHiddenPostByUrl"
            label="允许通过 URL 访问隐藏文章"
            width="md"
            valueEnum={{
              'true': '允许',
              'false': '禁止',
            }}
          />
          <ProFormSelect
            name="enableCustomizing"
            label="允许自定义"
            width="md"
            valueEnum={{
              'true': '允许',
              'false': '禁止',
            }}
          />
          <ProFormSelect
            name="showRSS"
            label="显示 RSS"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="openArticleLinksInNewWindow"
            label="新窗口打开文章链接"
            width="md"
            valueEnum={{
              'true': '是',
              'false': '否',
            }}
          />
          <ProFormSelect
            name="showExpirationReminder"
            label="显示过期提醒"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
          <ProFormSelect
            name="showEditButton"
            label="显示编辑按钮"
            width="md"
            valueEnum={{
              'true': '显示',
              'false': '隐藏',
            }}
          />
        </StepsForm.StepForm>
      </StepsForm>
    </div>
  );
};

export default InitPage;
