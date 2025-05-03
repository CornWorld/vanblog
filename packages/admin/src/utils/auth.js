import i18next from 'i18next';
/**
 * 认证工具函数
 *
 * 处理用户token存储、检索和有效性检查
 */

import { isAuthPage as isAuthRoute } from '../router';

// 开发模式检测
const isDevelopment =
  process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';

// token存储键名
const TOKEN_KEY = 'token';
const DEV_TOKEN = 'dev-token';

// 重定向循环检测相关键名和配置
const REDIRECT_CYCLE_KEY = 'vanblog_redirect_count';
const REDIRECT_CYCLE_THRESHOLD = 3; // 检测到3次重定向就认为是循环
const REDIRECT_TIMESTAMP_KEY = 'vanblog_redirect_timestamp';
const REDIRECT_TIMEOUT_MS = 10000; // 10秒内的重定向计入循环检测

/**
 * 检查并管理重定向循环
 *
 * @returns {boolean} 如果检测到循环则返回true
 */
export const checkRedirectCycle = () => {
  const now = Date.now();
  const lastRedirect = parseInt(sessionStorage.getItem(REDIRECT_TIMESTAMP_KEY) || '0', 10);
  const count = parseInt(sessionStorage.getItem(REDIRECT_CYCLE_KEY) || '0', 10);

  // 如果距离上次重定向超过10秒，重置计数器
  if (now - lastRedirect > REDIRECT_TIMEOUT_MS) {
    sessionStorage.setItem(REDIRECT_CYCLE_KEY, '1');
    sessionStorage.setItem(REDIRECT_TIMESTAMP_KEY, now.toString());
    console.log(i18next.t('auth.debug.reset_redirect_cycle'));
    return false;
  }

  // 增加计数
  const newCount = count + 1;
  sessionStorage.setItem(REDIRECT_CYCLE_KEY, newCount.toString());
  sessionStorage.setItem(REDIRECT_TIMESTAMP_KEY, now.toString());
  console.log(i18next.t('auth.debug.redirect_counter', { count: newCount }));

  // 检查是否处于循环中
  if (newCount >= REDIRECT_CYCLE_THRESHOLD) {
    console.error(
      i18next.t('auth.debug.redirect_cycle_detected', {
        count: newCount,
        seconds: Math.round((now - lastRedirect) / 1000),
      }),
    );
    return true;
  }

  return false;
};

/**
 * 重置重定向循环检测
 */
export const resetRedirectCycle = () => {
  if (sessionStorage.getItem(REDIRECT_CYCLE_KEY)) {
    console.log(i18next.t('auth.debug.resetting_redirect_cycle'));
    sessionStorage.removeItem(REDIRECT_CYCLE_KEY);
    sessionStorage.removeItem(REDIRECT_TIMESTAMP_KEY);
  }
};

/**
 * 检查当前页面是否为认证页面
 */
const isAuthPage = () => {
  return isAuthRoute();
};

/**
 * 从localStorage获取访问令牌
 *
 * @returns {string|null} 访问令牌或null
 */
export const getAccessToken = () => {
  try {
    // 在开发模式下，确保始终有token，除非在认证页面
    if (isDevelopment && !localStorage.getItem(TOKEN_KEY) && !isAuthPage()) {
      console.info(i18next.t('auth.dev.setting_token'));
      localStorage.setItem(TOKEN_KEY, DEV_TOKEN);
    }

    const token = localStorage.getItem(TOKEN_KEY);
    // 验证token是否有效 (简单检查)
    if (token && typeof token === 'string' && token.length > 10) {
      return token;
    }

    // 无效token应该被清除
    if (token && (typeof token !== 'string' || token.length <= 10)) {
      console.warn(i18next.t('auth.debug.invalid_token'));
      localStorage.removeItem(TOKEN_KEY);
    }

    return null;
  } catch (e) {
    console.error(i18next.t('auth.debug.token_access_error'), e);
    return null;
  }
};

/**
 * 在localStorage中设置访问令牌
 *
 * @param {string} token 要存储的令牌
 */
export const setAccessToken = (token) => {
  if (!token) {
    console.warn(i18next.t('auth.debug.empty_token'));
    return;
  }

  // 简单验证token
  if (typeof token !== 'string' || token.length <= 10) {
    console.warn(i18next.t('auth.debug.invalid_token_attempt'));
    return;
  }

  try {
    console.log(i18next.t('auth.debug.setting_access_token'));
    localStorage.setItem(TOKEN_KEY, token);
    // 设置新token后重置重定向循环检测
    resetRedirectCycle();
  } catch (e) {
    console.error(i18next.t('auth.debug.token_save_error'), e);
  }
};

/**
 * 从localStorage中移除访问令牌
 */
export const removeAccessToken = () => {
  try {
    if (localStorage.getItem(TOKEN_KEY)) {
      console.log(i18next.t('auth.debug.removing_token'));
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error(i18next.t('auth.debug.token_removal_error'), e);
  }
};

/**
 * 检查用户是否已登录
 *
 * @returns {boolean} 如果用户已登录则返回true
 */
export const isLoggedIn = () => {
  return !!getAccessToken();
};

/**
 * 检查用户是否为管理员
 *
 * @param {string} userType 用户类型
 * @returns {boolean} 如果用户是管理员则返回true
 */
export const isAdmin = (userType) => {
  // 在开发模式下，始终返回管理员权限
  if (isDevelopment) {
    return true;
  }
  return userType !== 'collaborator';
};
