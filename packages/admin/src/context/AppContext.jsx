import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { PageLoading } from '@ant-design/pro-layout';
import { message, Modal } from 'antd';
import dayjs from '@/utils/dayjs';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchAllMeta, fetchLatestVersionInfo } from '../services/van-blog/api';
import {
  checkRedirectCycle,
  removeAccessToken,
  isLoggedIn,
  resetRedirectCycle,
} from '../utils/auth';
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

  const fetchInitData = async (option) => {
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
  };

  // 检查版本更新
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
    // 初始化当前APP的状态
    const init = async () => {
      console.log('[DEBUG] Starting app initialization');
      setLoading(true);

      try {
        // 定义重要路径的检查函数
        const isLoginPage = location.pathname.includes(loginPath);
        const isInitPage = location.pathname.includes(initPath);
        const isRestorePage = location.pathname.includes('/user/restore');
        const isOnAuthPage = isLoginPage || isInitPage || isRestorePage;
        const isAuthenticated = isLoggedIn();

        console.log('[DEBUG] Init context:', {
          path: location.pathname,
          isOnAuthPage,
          isAuthenticated,
        });

        // 检查重定向循环
        if (!isOnAuthPage && !isAuthenticated && checkRedirectCycle()) {
          console.error('[DEBUG] Breaking redirect cycle during initialization');
          message.error('检测到重定向循环，请刷新页面或清除浏览器缓存', 10);
          removeAccessToken();
          setInitialState({
            fetchInitData,
            settings: {
              navTheme: 'light',
              layout: 'side',
              headerRender: false,
            },
          });
          setLoading(false);
          return;
        }

        // 重置重定向循环计数，特别是在认证页面
        if (isOnAuthPage) {
          console.log('[DEBUG] On auth page, resetting redirect cycle');
          resetRedirectCycle();
        }

        // 如果在初始化页面，设置最小状态
        if (isInitPage) {
          console.log('[DEBUG] On init page, setting minimal state');
          setInitialState({
            fetchInitData,
            settings: {
              navTheme: 'light',
              layout: 'side',
              headerRender: false,
            },
          });
          setLoading(false);

          // 尝试获取初始化数据以检查是否需要初始化
          console.log('[DEBUG] Checking if initialization is needed');
          fetchInitData().catch((err) => {
            console.warn('[DEBUG] Error checking initialization status:', err);
          });
          return;
        }

        // 首先检查用户是否已登录
        if (!isAuthenticated && !isOnAuthPage) {
          console.log('[DEBUG] Not authenticated, redirecting to login from:', location.pathname);
          setLoading(false);
          // 将当前路径添加为重定向参数
          const redirectParam =
            location.pathname !== '/' ? `?redirect=${encodeURIComponent(location.pathname)}` : '';
          navigate(`${loginPath}${redirectParam}`, { replace: true });
          return;
        }

        // 只有在非认证页面且已认证时才获取初始化数据
        let meta = {};
        if (!isOnAuthPage || isAuthenticated) {
          // 获取初始化数据
          meta = await fetchInitData();
        }

        // 检查获取的数据
        if (!meta || Object.keys(meta).length === 0) {
          console.warn('[DEBUG] Empty meta data received');
          if (isAuthenticated && !isOnAuthPage) {
            console.log('[DEBUG] Token might be invalid, but not redirecting to avoid loops');
            // 不立即重定向，让页面级检查处理，避免循环
          }
        }

        // 设置完整状态
        console.log('[DEBUG] Setting complete initial state');
        setInitialState({
          ...meta,
          fetchInitData,
          checkVersionUpdate,
          settings: {
            navTheme: 'light',
            layout: 'side',
          },
        });

        // 检查版本更新
        if (meta.version) {
          checkVersionUpdate(meta.version);
        }
      } catch (error) {
        console.error('[DEBUG] Error during initialization:', error);
        // 设置默认状态作为回退
        setInitialState({
          fetchInitData,
          settings: {
            navTheme: 'light',
            layout: 'side',
            headerRender: false,
          },
        });
      } finally {
        console.log('[DEBUG] Initialization finished');
        setLoading(false);
      }
    };

    init();
  }, [location.pathname, navigate]);

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
