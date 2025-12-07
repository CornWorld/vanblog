import { initContract } from '@ts-rest/core';
import { z } from 'zod';

export const createAdminCompatibilityContract = (c: ReturnType<typeof initContract>) =>
  c.router({
    triggerISR: {
      method: 'POST',
      path: '/v2/admin/isr/trigger',
      body: z.object({}),
      responses: { 200: z.object({ success: z.boolean(), message: z.string() }) },
    },
    getISRConfig: {
      method: 'GET',
      path: '/v2/admin/isr/config',
      responses: { 200: z.object({ skip: z.boolean(), interval: z.number() }) },
    },
    updateISRConfig: {
      method: 'PUT',
      path: '/v2/admin/isr/config',
      body: z.record(z.string(), z.any()),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    getCaddyLogs: {
      method: 'GET',
      path: '/v2/admin/caddy/logs',
      responses: { 200: z.object({ logs: z.array(z.string()) }) },
    },
    clearCaddyLogs: {
      method: 'DELETE',
      path: '/v2/admin/caddy/logs',
      responses: { 200: z.object({ success: z.boolean() }) },
    },
    getCaddyConfig: {
      method: 'GET',
      path: '/v2/admin/caddy/config',
      responses: { 200: z.object({ config: z.string() }) },
    },
    getHttpsConfig: {
      method: 'GET',
      path: '/v2/admin/settings/https',
      responses: { 200: z.object({ enabled: z.boolean(), email: z.string(), domain: z.string() }) },
    },
    updateHttpsConfig: {
      method: 'PUT',
      path: '/v2/admin/settings/https',
      body: z.record(z.string(), z.any()),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    getLoginConfig: {
      method: 'GET',
      path: '/v2/admin/settings/login',
      responses: { 200: z.object({ allowRegister: z.boolean(), allowSocialLogin: z.boolean() }) },
    },
    updateLoginConfig: {
      method: 'PUT',
      path: '/v2/admin/settings/login',
      body: z.record(z.string(), z.any()),
      responses: { 200: z.record(z.string(), z.any()) },
    },
    getWalineConfig: {
      method: 'GET',
      path: '/v2/admin/settings/waline',
      responses: { 200: z.object({ serverURL: z.string(), pageSize: z.number() }) },
    },
    updateWalineConfig: {
      method: 'PUT',
      path: '/v2/admin/settings/waline',
      body: z.record(z.string(), z.any()),
      responses: { 200: z.record(z.string(), z.any()) },
    },
  });
