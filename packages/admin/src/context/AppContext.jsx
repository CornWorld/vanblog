import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { PageLoading } from '@ant-design/pro-layout';
import { Modal } from 'antd';
import dayjs from '@/utils/dayjs';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchAllMeta, fetchLatestVersionInfo } from '../services/van-blog/api';
import { ROUTES } from '../router';

const AppContext = createContext(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [initialState, setInitialState] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // 使用路由常量
  const loginPath = ROUTES.LOGIN;
  const initPath = ROUTES.INIT;

  // Detect if we're in development mode
  const needMock = process.env.previewMode === 'true';

  const fetchInitData = useCallback(
    async (option) => {
      try {
        console.log('[DEBUG] Fetching init data with options:', { option });
        const msg = await fetchAllMeta(option);
        console.log('[DEBUG] Init data response status:', msg.statusCode);

        // 如果需要初始化并且不在初始化页面，就重定向到初始化页面
        if (msg.statusCode === 233) {
          console.log('[DEBUG] App needs initialization');
          if (location.pathname !== initPath) {
            console.log('[DEBUG] Redirecting to /init');
            navigate(initPath, { replace: true });
          } else {
            console.log('[DEBUG] Already on init page, not redirecting');
          }
          return msg.data || {};
        } else if (location.pathname === initPath && msg.statusCode === 200) {
          console.log('[DEBUG] On init page but app is initialized, redirecting to home');
          navigate('/', { replace: true });
        }

        if (msg.statusCode === 200 && msg.data) {
          console.log('[DEBUG] Init data successfully fetched');
          return msg.data;
        } else {
          console.warn('[DEBUG] Failed to fetch init data:', msg);
          return {};
        }
      } catch (error) {
        console.error('[DEBUG] Error fetching init data:', error);

        // 如果状态码是 233，表示需要初始化
        if (error.response?.status === 233 || error.data?.statusCode === 233) {
          console.log('[DEBUG] System needs initialization');
          if (location.pathname !== initPath) {
            console.log('[DEBUG] Redirecting to init page');
            navigate(initPath, { replace: true });
          }
          return {};
        }

        // In development mode, provide default data instead of redirecting to login
        if (needMock) {
          console.warn('[DEBUG] Using mock data for development');
          return {
            latestVersion: '0.0.0-dev',
            updatedAt: new Date().toISOString(),
            baseUrl: 'http://localhost',
            version: 'dev-previewMode',
            user: { username: 'dev-user', type: 'admin' },
          };
        }

        // Don't redirect to login if already on login page or in the login process
        const isOnAuthPage =
          location.pathname.includes(loginPath) || location.pathname.includes(initPath);

        if (!isOnAuthPage) {
          console.log('[DEBUG] Not on auth page, redirecting to login');
          navigate(loginPath, { replace: true });
        } else {
          console.log('[DEBUG] Already on auth page, not redirecting');
        }

        return {};
      }
    },
    [navigate, location, initPath, loginPath, needMock],
  );

  // We're keeping the function definition for checkVersionUpdate since it might be used elsewhere
  // through the context, but we'll mark it with a // eslint comment to ignore the warning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const checkVersionUpdate = async (currentVersion) => {
    try {
      if (!currentVersion || currentVersion.includes('dev')) {
        return; // 开发版本不检查更新
      }

      const { data } = await fetchLatestVersionInfo();

      if (data && data.version && data.version !== currentVersion) {
        console.log('[DEBUG] New version available:', data.version);

        Modal.info({
          title: '版本更新',
          content: (
            <div>
              <p style={{ marginBottom: 4 }}>有新版本！</p>
              <p style={{ marginBottom: 4 }}>{`当前版本:\t${currentVersion}`}</p>
              <p style={{ marginBottom: 4 }}>{`最新版本:\t${data.version}`}</p>
              <p style={{ marginBottom: 4 }}>{`更新时间:\t${dayjs(data.updatedAt).format(
                'YYYY-MM-DD HH:mm:ss',
              )}`}</p>
              <p style={{ marginBottom: 4 }}>
                {`更新日志:\t`}
                <a
                  target={'_blank'}
                  href="https://vanblog.mereith.com/ref/changelog.html"
                  rel="noreferrer"
                >
                  点击查看
                </a>
              </p>
              <p style={{ marginBottom: 4 }}>
                {`更新方法:\t`}
                <a
                  target={'_blank'}
                  href="https://vanblog.mereith.com/guide/update.html#%E5%8D%87%E7%BA%A7%E6%96%B9%E6%B3%95"
                  rel="noreferrer"
                >
                  点击查看
                </a>
              </p>
            </div>
          ),
        });
      }
    } catch (error) {
      console.error('[DEBUG] Error checking version update:', error);
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const data = await fetchInitData();
        if (data) {
          setInitialState((prevState) => ({
            ...prevState,
            ...data,
            fetchInitData,
            settings: {
              ...(prevState?.settings || {}),
              navTheme: 'light',
              layout: 'side',
              title: 'VanBlog',
            },
          }));
        }
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [location, fetchInitData, initPath, loginPath]);

  // 处理窗口大小变化
  useEffect(() => {
    const handleSizeChange = () => {
      try {
        // 尝试设置CSS变量
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        document.documentElement.style.setProperty('--window-height', `${window.innerHeight}px`);
      } catch (error) {
        console.error('[DEBUG] Error setting viewport height variables:', error);
      }
    };

    // 初始设置
    handleSizeChange();

    // 监听窗口大小变化
    window.addEventListener('resize', handleSizeChange);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleSizeChange);
    };
  }, []);

  // 本地存储颜色主题绑定
  const colorPrimary = useMemo(() => {
    try {
      const root = getComputedStyle(document.documentElement);
      return root.getPropertyValue('--color-primary').trim();
    } catch {
      return '#1677FF'; // 默认蓝色
    }
  }, []);

  // 在加载中状态，显示加载器
  if (loading) {
    return <PageLoading />;
  }

  // 提供上下文
  return (
    <AppContext.Provider
      value={{
        initialState,
        setInitialState,
        loading,
        colorPrimary,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
