import { z } from 'zod';

/**
 * 端口号验证 schema
 * 必须是 1-65535 之间的正整数
 */
const portSchema = z.coerce.number().int().positive().max(65535);

/**
 * 应用配置 schema
 *
 * 定义所有环境变量的验证规则和默认值，确保配置的类型安全和完整性。
 * 使用 Zod 进行运行时验证，防止无效配置导致的应用启动失败。
 */
export const configSchema = z.object({
  // ============ 应用配置 ============
  PORT: portSchema.default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('v2'),

  // ============ 数据库配置 ============
  DATABASE_DRIVER: z.enum(['local', 'turso', 'd1']).default('local'),
  DATABASE_URL: z.string().default('file:./data/vanblog.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  DATABASE_FILE_PATH: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_DATABASE_ID: z.string().optional(),
  CLOUDFLARE_D1_TOKEN: z.string().optional(),

  // ============ JWT 配置 ============
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // ============ CORS 配置 ============
  CORS_ORIGIN: z
    .union([z.string(), z.array(z.string())])
    .default('http://localhost:3001,http://localhost:3002'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // ============ 文件上传配置 ============
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().int().positive().default(52428800), // 50MB
  UPLOAD_DESTINATION: z.string().default('./uploads'),

  // ============ 静态文件配置 ============
  STATIC_PATH: z.string().default('./data/static'),

  // ============ 日志配置 ============
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  LOG_DIR: z.string().default('/var/log/vanblog'),

  // ============ Waline 评论系统配置 ============
  WALINE_DB: z.string().default('waline'),

  // ============ 运行时配置 ============
  DEMO_MODE: z.coerce.boolean().default(false),
  CODE_RUNNER_PATH: z.string().default('/app/codeRunner'),
  PLUGIN_RUNNER_PATH: z.string().default('/app/pluginRunner'),
});

/**
 * 配置 schema 的 TypeScript 类型
 * 自动从 Zod schema 推导类型，确保类型与验证规则一致
 */
export type ConfigSchema = z.infer<typeof configSchema>;

/**
 * 配置验证函数
 *
 * 在应用启动时验证所有环境变量，确保配置完整且有效。
 * 如果验证失败，会抛出详细的错误信息，阻止应用启动。
 *
 * @param config - 原始配置对象（来自环境变量）
 * @returns 验证并填充默认值后的配置对象
 * @throws 如果配置验证失败，抛出包含详细错误信息的 Error
 */
export function validateConfig(config: Record<string, unknown>): ConfigSchema {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    // 使用 Zod 内置的错误格式化功能
    throw new Error(`Config validation error: ${result.error.message}`);
  }
  return result.data;
}
