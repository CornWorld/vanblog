import { initClient } from '@ts-rest/core';
import { contract } from '@vanblog/shared';

// Original fetch
const originalFetch = window.fetch;

// Custom fetch wrapper that adds Authorization Bearer header
const authFetch = async (
  url: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> => {
  const token = localStorage.getItem('token');
  const authOptions: RequestInit = {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Also include Token header for compatibility with backend
      ...(token ? { Token: token } : {}),
    },
  };
  return originalFetch(url, authOptions);
};

// Override window.fetch globally for ts-rest
window.fetch = authFetch;

// ts-rest client (will use the overridden fetch)
export const client = initClient(contract, {
  baseUrl: '/api',
  credentials: 'include',
  baseHeaders: {},
  jsonQuery: true,
});
