export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  apiVersion: string;
  locale: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

export interface DatabaseConfig {
  driver: 'local' | 'turso' | 'd1';
  url: string;
  authToken?: string;
  filePath?: string;
  accountId?: string;
  databaseId?: string;
  d1Token?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface CorsConfig {
  origin: string | string[];
  credentials: boolean;
}

export interface UploadConfig {
  maxFileSize: number;
  destination: string;
}

export interface StaticConfig {
  path: string;
}

export interface LogConfig {
  level: string;
  dir: string;
}

export interface WalineConfig {
  db: string;
}

export interface RuntimeConfig {
  demoMode: boolean;
  codeRunnerPath: string;
  pluginRunnerPath: string;
}

export interface AllConfig {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
  upload: UploadConfig;
  static: StaticConfig;
  log: LogConfig;
  waline: WalineConfig;
  runtime: RuntimeConfig;
}
