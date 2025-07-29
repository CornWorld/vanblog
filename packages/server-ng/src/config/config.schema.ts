import { z } from 'zod';

const portSchema = z.coerce.number().int().positive().max(65535);

export const configSchema = z.object({
  // Application
  PORT: portSchema.default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('v2'),

  // Database
  DATABASE_DRIVER: z.enum(['local', 'turso', 'd1']).default('local'),
  DATABASE_URL: z.string().default('file:./data/vanblog.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  DATABASE_FILE_PATH: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_DATABASE_ID: z.string().optional(),
  CLOUDFLARE_D1_TOKEN: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // CORS
  CORS_ORIGIN: z
    .union([z.string(), z.array(z.string())])
    .default('http://localhost:3001,http://localhost:3002'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // File Upload
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().int().positive().default(52428800), // 50MB
  UPLOAD_DESTINATION: z.string().default('./uploads'),

  // Static Files
  STATIC_PATH: z.string().default('/app/static'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  LOG_DIR: z.string().default('/var/log/vanblog'),

  // Waline
  WALINE_DB: z.string().default('waline'),

  // Demo Mode
  DEMO_MODE: z.coerce.boolean().default(false),

  // Code Runner
  CODE_RUNNER_PATH: z.string().default('/app/codeRunner'),
  PLUGIN_RUNNER_PATH: z.string().default('/app/pluginRunner'),
});

export type ConfigSchema = z.infer<typeof configSchema>;

export function validateConfig(config: Record<string, unknown>): ConfigSchema {
  const result = configSchema.safeParse(config);

  if (result.success) {
    return result.data;
  }

  // Format validation errors

  const errorMessages: string[] = [];

  for (const err of result.error.errors) {
    const path = err.path.length > 0 ? err.path.join('.') : 'root';

    errorMessages.push(`${path}: ${err.message}`);
  }
  const errors = errorMessages.join(', ');

  throw new Error(`Config validation error: ${errors}`);
}
