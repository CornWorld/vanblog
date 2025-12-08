import { initContract } from '@ts-rest/core';
import { z } from 'zod';

/**
 * ISR (增量静态再生成) 配置 schema
 *
 * ISR (Incremental Static Regeneration) configuration schema
 */
const ISRConfigSchema = z.object({
  skip: z.boolean(),
  interval: z.number(),
});

/**
 * HTTPS 配置 schema
 *
 * HTTPS configuration schema
 */
const HttpsConfigSchema = z.object({
  enabled: z.boolean(),
  email: z.string(),
  domain: z.string(),
});

/**
 * 登录配置 schema
 *
 * Login configuration schema
 */
const LoginConfigSchema = z.object({
  allowRegister: z.boolean(),
  allowSocialLogin: z.boolean(),
});

/**
 * Waline 评论系统配置 schema
 *
 * Waline comment system configuration schema
 */
const WalineConfigSchema = z.object({
  serverURL: z.string(),
  pageSize: z.number(),
});

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
      responses: { 200: ISRConfigSchema },
    },
    updateISRConfig: {
      method: 'PUT',
      path: '/v2/admin/isr/config',
      body: ISRConfigSchema.partial(),
      responses: { 200: ISRConfigSchema },
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
      responses: { 200: HttpsConfigSchema },
    },
    updateHttpsConfig: {
      method: 'PUT',
      path: '/v2/admin/settings/https',
      body: HttpsConfigSchema.partial(),
      responses: { 200: HttpsConfigSchema },
    },
    getLoginConfig: {
      method: 'GET',
      path: '/v2/admin/settings/login',
      responses: { 200: LoginConfigSchema },
    },
    updateLoginConfig: {
      method: 'PUT',
      path: '/v2/admin/settings/login',
      body: LoginConfigSchema.partial(),
      responses: { 200: LoginConfigSchema },
    },
    getWalineConfig: {
      method: 'GET',
      path: '/v2/admin/settings/waline',
      responses: { 200: WalineConfigSchema },
    },
    updateWalineConfig: {
      method: 'PUT',
      path: '/v2/admin/settings/waline',
      body: WalineConfigSchema.partial(),
      responses: { 200: WalineConfigSchema },
    },
  });
