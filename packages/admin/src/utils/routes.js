import { useNavigate, useLocation } from 'react-router-dom';
import { history } from './umiCompat'; // 导入历史对象，保持兼容性

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

// 导出现有的历史对象，确保兼容性
export { history };
