import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  // Server side (including build time)
  const serverUrl = process.env.VAN_BLOG_SERVER_URL || 'http://127.0.0.1:3000';
  return `${serverUrl}/api`;
};

export const tsRestClient = initClient(contract, {
  baseUrl: getBaseUrl(),
  baseHeaders: {},
});
