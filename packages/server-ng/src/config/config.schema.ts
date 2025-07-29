import { z } from 'zod';

const portSchema = z.coerce.number().int().positive().max(65535);

const uriSchema = z.string().regex(/^(mongodb|mongodb+srv):\/\/.+/, 'Must be a valid MongoDB URI');

export const configSchema = z.object({
  // Application
  PORT: portSchema.default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('v2'),

  // Database
  MONGODB_URI: uriSchema.default('mongodb://localhost:27017/vanblog'),
  DATABASE_HOST: z.string().optional(),
  DATABASE_PORT: portSchema.optional(),
  DATABASE_NAME: z.string().optional(),
  DATABASE_USER: z.string().optional(),
  DATABASE_PASS: z.string().optional(),

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
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors
        .map((e) => {
          const path = e.path.join('.');
          return `${path}: ${e.message}`;
        })
        .join(', ');
      throw new Error(`Config validation error: ${errors}`);
    }
    throw error;
  }
}
