import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HomeOutlined,
  LogoutOutlined,
  ProjectOutlined,
  SmileOutlined,
  FormOutlined,
  ContainerOutlined,
  PictureOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { PageLoading, ProLayout, SettingDrawer } from '@ant-design/pro-layout';
import { Menu } from 'antd';
import { useAppContext } from '../context/AppContext';
import Footer from '@/components/Footer';
import LogoutButton from '@/components/LogoutButton';
import ThemeButton from '@/components/ThemeButton';
import { mapTheme, writeTheme } from '@/services/van-blog/theme';
import { useTranslation } from 'react-i18next';

const trans_zh = {
  'common.logout': '退出登录',
  'common.home': '主站',
  'common.about': '关于',
  'layout.collaborator_mode': '协作模式',
};

// Route config
import routes from './routes';

// Icon mapping
const IconMap = {
  SmileOutlined: <SmileOutlined />,
  FormOutlined: <FormOutlined />,
  ContainerOutlined: <ContainerOutlined />,
  PictureOutlined: <PictureOutlined />,
  ToolOutlined: <ToolOutlined />,
};

// Custom logo and title component
const LogoTitle = ({ logo, title, collapsed }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {logo && (
        <img src={logo} alt="logo" style={{ height: 28, marginRight: collapsed ? 0 : 12 }} />
      )}
      {!collapsed && <strong style={{ margin: 0, color: '#1890ff', fontSize: 16 }}>{title}</strong>}
    </div>
  );
};

// Custom bottom links component using actual Ant Menu to match top menu
const CustomBottomLinks = ({ collapsed }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Effect to detect theme changes
  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme') === 'dark';
      setIsDarkMode(theme);
    };

    // Check initial theme
    checkTheme();

    // Create observer to detect theme attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          checkTheme();
        }
      });
    });

    // Start observing
    observer.observe(document.documentElement, { attributes: true });

    // Cleanup
    return () => observer.disconnect();
  }, []);

  const menuTheme = isDarkMode ? 'dark' : 'light';

  // Handle menu clicks
  const handleMenuClick = ({ key }) => {
    if (key === 'home') {
      window.open('/', '_blank');
    } else if (key === 'about') {
      navigate('/about');
    }
  };

  // Theme button menu item
  const ThemeMenuItem = () => (
    <div style={{ padding: collapsed ? '0' : '0 8px 0 6px' }}>
      <ThemeButton showText={!collapsed} />
    </div>
  );

  // Logout button menu item
  const LogoutMenuItem = () => (
    <div style={{ padding: collapsed ? '0' : '0 8px 0 6px' }}>
      <LogoutButton
        trigger={
          <a style={{ display: 'flex', alignItems: 'center' }}>
            <LogoutOutlined style={{ marginRight: collapsed ? 0 : 10 }} />
            {!collapsed && <span>{t('common.logout') || trans_zh['common.logout']}</span>}
          </a>
        }
      />
    </div>
  );

  return (
    <div className="custom-bottom-links">
      <Menu
        theme={menuTheme}
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[]}
        onClick={handleMenuClick}
        items={[
          {
            key: 'home',
            icon: <HomeOutlined />,
            label: t('common.home') || trans_zh['common.home'],
          },
          {
            key: 'about',
            icon: <ProjectOutlined />,
            label: t('common.about') || trans_zh['common.about'],
          },
          {
            key: 'theme',
            icon: null,
            label: <ThemeMenuItem />,
          },
          {
            key: 'logout',
            icon: null,
            label: <LogoutMenuItem />,
          },
        ]}
      />
    </div>
  );
};

const BasicLayout = () => {
  const { initialState, setInitialState } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  if (!initialState) {
    return <PageLoading />;
  }

  return (
    <div style={{ height: '100vh' }}>
      <ProLayout
        {...initialState.settings}
        route={{ routes }}
        location={location}
        title={initialState.settings.title || 'VanBlog'}
        logo={'/logo.svg'}
        headerRender={false}
        menuHeaderRender={(logoDom, titleDom, props) => (
          <LogoTitle
            logo={logoDom.props.src}
            title={initialState.settings.title || titleDom}
            collapsed={props?.collapsed}
          />
        )}
        menuItemRender={(menuItemProps, defaultDom) => {
          if (menuItemProps.isUrl || !menuItemProps.path) {
            return defaultDom;
          }
          return <Link to={menuItemProps.path}>{defaultDom}</Link>;
        }}
        menuDataRender={(menuData) => {
          return menuData.map((item) => {
            if (item.icon && typeof item.icon === 'string') {
              return {
                ...item,
                icon: IconMap[item.icon],
              };
            }
            return item;
          });
        }}
        // Replace default links with custom component
        links={null}
        menuFooterRender={(props) => <CustomBottomLinks collapsed={props?.collapsed} />}
        footerRender={() => <Footer />}
        onMenuHeaderClick={() => navigate('/')}
        layout="side"
      >
        <Outlet />

        <SettingDrawer
          disableUrlParams
          enableDarkTheme
          settings={initialState.settings}
          onSettingChange={(settings) => {
            const user = initialState?.user;
            const isCollaborator = user?.type && user?.type === 'collaborator';
            if (isCollaborator) {
              settings.title = trans_zh['layout.collaborator_mode'];
            }
            if (settings.navTheme !== initialState?.settings?.navTheme) {
              // 切换了主题
              settings.navTheme = mapTheme(settings.theme || 'auto');
              writeTheme(settings.theme || 'auto');
            }
            setInitialState((prev) => ({
              ...prev,
              settings,
            }));
          }}
        />
      </ProLayout>
    </div>
  );
};

export default BasicLayout;
