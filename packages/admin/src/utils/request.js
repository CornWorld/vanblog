import { notification } from 'antd';
import { isLoggedIn, removeAccessToken } from './auth';
import { ROUTES, withPrefix } from '../router';

const trans_zh = {
  'request.message.network_error': '网络异常',
  'request.message.parse_failed': '解析响应失败',
  'request.message.401': '当前会话已过期，请重新登录',
  'request.message.503': '服务器暂时不可用，请稍后重试',
  'request.message.400': '请求参数错误',
  'request.message.403': '没有权限',
  'request.message.404': '资源不存在',
  'request.message.500': '服务器内部错误',
  'request.message.retry': '重试',
  'request.message.api_error': 'API 调用失败',
  'request.message.default_error': '请求失败，请重试',
  'request.message.go_login': '去登录',
};

// 是否是开发环境
const isDevelopment =
  process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';

// mock数据，开发调试用
// Deliberately left, might be needed for future development
const mockResponses = {
  '/api/admin/meta': { user: { username: 'dev', type: 'admin' } },
};

/**
 * 错误处理函数
 * @param {Error} error - 错误对象
 * @param {boolean} skipErrorHandler - 是否跳过错误处理
 * @param {string} url - 请求URL
 * @returns {object} - 返回错误处理结果
 */
const errorHandler = (error, skipErrorHandler, url) => {
  // 提取错误数据，但要注意保持命名以便调试
  const { response, message: errorMessage } = error;

  // 401表示未授权，通常是登录过期
  if (response?.status === 401 || error.status === 401) {
    notification.error({
      message: trans_zh['request.message.401'],
      description: `${error.data?.message || errorMessage || '请重新登录'}`,
    });

    // 移除登录凭证
    removeAccessToken();

    // 避免重定向循环（如果当前已经在登录页）
    const isLoginPage = window.location.pathname.includes(ROUTES.LOGIN);
    if (!isLoginPage) {
      setTimeout(() => {
        // 使用withPrefix函数添加'/admin'前缀
        window.location.href = withPrefix(ROUTES.LOGIN);
      }, 1000);
    }

    // 返回错误数据
    return { statusCode: 401, message: trans_zh['request.message.401'] };
  }

  // 根据响应状态码显示不同的错误信息
  if (response) {
    let errorText = '';

    // 尝试从响应中获取错误信息
    if (error.data?.message) {
      errorText = error.data.message;
    } else {
      // 根据状态码选择错误信息
      switch (response.status) {
        case 400:
          errorText = trans_zh['request.message.400'];
          break;
        case 403:
          errorText = trans_zh['request.message.403'];
          break;
        case 404:
          errorText = trans_zh['request.message.404'];
          break;
        case 500:
          errorText = trans_zh['request.message.500'];
          break;
        case 503:
          errorText = trans_zh['request.message.503'];
          break;
        default:
          errorText = trans_zh['request.message.default_error'];
      }
    }

    // 显示错误通知
    notification.error({
      message: `${trans_zh['request.message.api_error']} (${url})`,
      description: errorText,
    });

    // 返回带状态码的错误数据
    return {
      statusCode: response.status,
      message: errorText,
    };
  }

  // 这是一个网络错误（如无法连接服务器）
  notification.error({
    message: trans_zh['request.message.network_error'],
    description: errorMessage || 'Network Error',
  });

  // 返回网络错误数据
  return {
    statusCode: 600, // 自定义状态码表示网络错误
    message: trans_zh['request.message.network_error'],
  };
};

/**
 * 请求函数
 * @param {string} url - 请求URL
 * @param {object} options - 请求选项
 * @returns {Promise<object>} - 返回响应数据
 */
const request = async (url, options = {}) => {
  try {
    // 默认请求配置
    const defaultOptions = {
      credentials: 'include',
    };

    // 合并自定义选项（移除未使用的requestOptions）
    const newOptions = { ...defaultOptions, ...options };

    // 检查是否有token，并添加到header
    if (isLoggedIn()) {
      const token = localStorage.getItem('token');
      if (!newOptions.headers) {
        newOptions.headers = {};
      }
      newOptions.headers.Token = token;
    }

    // 如果是POST或PUT请求，且没有指定内容类型，则默认为JSON
    if (
      (newOptions.method === 'POST' || newOptions.method === 'PUT') &&
      !newOptions.headers?.['Content-Type']
    ) {
      newOptions.headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        ...newOptions.headers,
      };
    }

    // 确保body是JSON字符串
    if (
      newOptions.body &&
      typeof newOptions.body === 'object' &&
      !(newOptions.body instanceof FormData) &&
      newOptions.headers?.['Content-Type']?.includes('application/json')
    ) {
      newOptions.body = JSON.stringify(newOptions.body);
    }

    // Mock API响应（开发模式）
    if (isDevelopment && mockResponses[url] && !options.skipMock) {
      console.log('[MOCK] Returning mock data for', url);
      return {
        statusCode: 200,
        data: mockResponses[url],
      };
    }

    // 提取是否跳过错误处理的标志
    const { skipErrorHandler = false } = options;

    // 发送请求
    const response = await fetch(url, newOptions);

    // 解析响应JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      console.error('[DEBUG] Failed to parse JSON response:', e);
      responseData = { message: trans_zh['request.message.parse_failed'] };
    }

    if (response.ok) {
      return responseData;
    }

    // 如果是401状态码，特殊处理
    if (response.status === 401) {
      const error = new Error(responseData.message || 'Unauthorized');
      error.response = response;
      error.data = responseData;
      error.status = 401;

      console.log('[DEBUG] 401 Unauthorized detected in response:', JSON.stringify(responseData));
      console.log('[DEBUG] Request URL:', url);
      console.log(
        '[DEBUG] Request headers:',
        JSON.stringify({
          ...newOptions.headers,
          Token: newOptions.headers?.Token
            ? `${newOptions.headers.Token.substring(0, 15)}...`
            : undefined,
        }),
      );

      // 如果调用方要求跳过错误处理，直接抛出错误
      if (skipErrorHandler) {
        throw error;
      }

      return errorHandler(error, skipErrorHandler, url);
    }

    // 请求成功但业务逻辑错误
    const error = new Error(responseData.message || 'Request failed');
    error.response = response;
    error.data = responseData;
    throw error;
  } catch (error) {
    // 开发模式下记录更详细的错误信息
    if (isDevelopment) {
      console.warn(`[DEV] API error:`, error);
      console.warn(`[DEV] Details:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.data,
        message: error.message,
      });
    }

    if (!options.skipErrorHandler) {
      // Remove useless try/catch wrapper
      return errorHandler(error, options.skipErrorHandler, url);
    } else {
      throw error; // 如果调用方要求跳过错误处理，直接抛出错误
    }
  }
};

export default request;
