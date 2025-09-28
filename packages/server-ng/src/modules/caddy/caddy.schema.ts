import { z } from 'zod';

/**
 * HTTPS 设置 Schema
 */
export const HttpsSettingsSchema = z.object({
  redirect: z.boolean().describe('是否启用 HTTPS 重定向'),
  domains: z.array(z.string().min(1)).describe('HTTPS 域名列表'),
});

/**
 * 域名 Subject Schema
 */
export const DomainSubjectSchema = z.object({
  domain: z.string().min(1).describe('域名'),
});

/**
 * 域名列表 Schema
 */
export const DomainListSchema = z.object({
  domains: z.array(z.string().min(1)).describe('域名列表'),
});

/**
 * 重定向设置 Schema
 */
export const RedirectSettingsSchema = z.object({
  redirect: z.boolean().describe('是否启用重定向'),
});

/**
 * Caddy 配置响应 Schema
 */
export const CaddyConfigSchema = z.record(z.string(), z.unknown()).describe('Caddy 配置对象');

/**
 * Caddy 日志响应 Schema
 */
export const CaddyLogSchema = z.object({
  logs: z.string().describe('Caddy 日志内容'),
});

/**
 * 操作结果 Schema
 */
export const OperationResultSchema = z.object({
  success: z.boolean().describe('操作是否成功'),
  message: z.string().optional().describe('操作结果消息'),
});

// 导出类型
export type HttpsSettings = z.infer<typeof HttpsSettingsSchema>;
export type DomainSubject = z.infer<typeof DomainSubjectSchema>;
export type DomainList = z.infer<typeof DomainListSchema>;
export type RedirectSettings = z.infer<typeof RedirectSettingsSchema>;
export type CaddyConfig = z.infer<typeof CaddyConfigSchema>;
export type CaddyLog = z.infer<typeof CaddyLogSchema>;
export type OperationResult = z.infer<typeof OperationResultSchema>;
