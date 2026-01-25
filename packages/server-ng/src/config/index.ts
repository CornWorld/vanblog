export * from './config.module';
export * from './config.service';
export type * from './config.interface';

// Configuration validation utilities
// configSchema: Zod schema for validating configuration objects
// validateConfig: Function to validate configuration and return typed result
export { configSchema, validateConfig } from './config.schema';
export type { ConfigSchema } from './config.schema';
