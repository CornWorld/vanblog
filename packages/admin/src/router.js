import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAppContext } from './context/AppContext';

// 定义路由常量
export const ROUTES = {
  LOGIN: '/user/login',
  HOME: '/',
  ARTICLE: '/article',
  RESTORE: '/user/restore',
  INIT: '/init',
  WELCOME: '/welcome',
};

// 基础路径 - 来自Vite配置的base
export const BASE_PATH = '/admin';

// 处理前缀的函数 - 用于直接浏览器重定向
export const withPrefix = (path) => {
  // 确保路径以/开头，并且不会有双斜杠
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // 如果已经包含前缀，则不再添加
  if (normalizedPath.startsWith(`${BASE_PATH}/`) || normalizedPath === BASE_PATH) {
    return normalizedPath;
  }

  return `${BASE_PATH}${normalizedPath}`;
};

// 使用React Router导航的钩子
export const useAppNavigate = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 包装导航函数以处理重定向等
  const appNavigate = (to, options = {}) => {
    // 如果to是LOGIN并且有要返回的路径，添加redirect参数
    if (to === ROUTES.LOGIN && !to.includes('redirect=') && location.pathname !== ROUTES.LOGIN) {
      to = `${ROUTES.LOGIN}?redirect=${encodeURIComponent(location.pathname)}`;
    }
    navigate(to, options);
  };

  return appNavigate;
};

// 获取当前URL中的redirect参数
export const getRedirectParam = () => {
  const query = new URLSearchParams(window.location.search);
  return query.get('redirect') || ROUTES.HOME;
};

// 检查路径是否为认证页面
export const isAuthPage = (path) => {
  const currentPath = path || window.location.pathname;
  return (
    currentPath.includes(ROUTES.LOGIN) ||
    currentPath.includes(ROUTES.INIT) ||
    currentPath.includes(ROUTES.RESTORE)
  );
};

// 创建一个简单的历史对象，与React Router v6集成
export const createHistory = (navigate, location) => {
  return {
    push: (path) => {
      if (typeof path === 'string') {
        navigate(path);
      } else if (typeof path === 'object' && path.pathname) {
        // 处理对象形式的路径配置
        const { pathname, query } = path;
        if (!query) {
          navigate(pathname);
          return;
        }

        // 构建查询字符串
        const searchParams = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value);
          }
        });

        const queryString = searchParams.toString();
        navigate(`${pathname}${queryString ? `?${queryString}` : ''}`);
      }
    },
    replace: (path) => {
      if (typeof path === 'string') {
        navigate(path, { replace: true });
      } else if (typeof path === 'object' && path.pathname) {
        // 处理对象形式的路径配置
        const { pathname, query } = path;
        if (!query) {
          navigate(pathname, { replace: true });
          return;
        }

        // 构建查询字符串
        const searchParams = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value);
          }
        });

        const queryString = searchParams.toString();
        navigate(`${pathname}${queryString ? `?${queryString}` : ''}`, { replace: true });
      }
    },
    go: (step) => navigate(step),
    goBack: () => navigate(-1),
    get location() {
      // 将React Router location转换为umi兼容格式
      return {
        ...location,
        query: Object.fromEntries(new URLSearchParams(location.search)),
      };
    },
  };
};

// 创建一个全局可访问的history对象
// 这是为了向后兼容那些直接导入history的组件
let globalHistory = null;

// 导出一个初始化history的函数，用于在App组件中设置全局history
export const initGlobalHistory = (navigate, location) => {
  globalHistory = createHistory(navigate, location);
  return globalHistory;
};

// 导出可被其他模块直接导入的history对象
// 这将在App组件中通过initGlobalHistory初始化
export const history = {
  push: (path) => {
    if (globalHistory) {
      globalHistory.push(path);
    } else {
      console.warn('History not initialized. Use useHistory hook instead.');
      // 回退到直接使用window.location
      const url = typeof path === 'string' ? path : path.pathname;
      window.location.href = withPrefix(url);
    }
  },
  replace: (path) => {
    if (globalHistory) {
      globalHistory.replace(path);
    } else {
      console.warn('History not initialized. Use useHistory hook instead.');
      // 回退到直接使用window.location
      const url = typeof path === 'string' ? path : path.pathname;
      window.location.replace(withPrefix(url));
    }
  },
  go: (step) => {
    if (globalHistory) {
      globalHistory.go(step);
    } else {
      window.history.go(step);
    }
  },
  goBack: () => {
    if (globalHistory) {
      globalHistory.goBack();
    } else {
      window.history.back();
    }
  },
  get location() {
    if (globalHistory) {
      return globalHistory.location;
    }
    // 提供一个模拟的location对象
    return {
      ...window.location,
      query: Object.fromEntries(new URLSearchParams(window.location.search)),
    };
  },
};

// 使用React Router v6的钩子获取history对象
export const useHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return createHistory(navigate, location);
};

// 从react-router-dom导出Link组件
export const Link = RouterLink;

// 初始化history的自定义钩子，为了向后兼容
export const useInitHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return { navigate, location };
};

// Replacement for UMI's useModel hook
export const useModel = () => {
  const context = useAppContext();
  // Ensure these are objects/functions that can be safely called
  const initialState = context?.initialState || {};
  const setInitialState = context?.setInitialState || ((state) => state);

  return {
    initialState,
    setInitialState,
    loading: !initialState,
  };
};
