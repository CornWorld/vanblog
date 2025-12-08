import { registerAs } from '@nestjs/config';

/**
 * 数据库驱动类型
 * - local: 本地 SQLite 文件数据库
 * - turso: Turso 云数据库服务
 * - d1: Cloudflare D1 数据库
 */
export type DatabaseDriver = 'local' | 'turso' | 'd1';

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  /** 数据库驱动类型 */
  driver: DatabaseDriver;
  /** 数据库连接 URL */
  url: string;
  /** Turso 认证令牌（仅用于 turso 驱动） */
  authToken?: string;
  /** 本地 SQLite 文件路径（仅用于 local 驱动） */
  filePath?: string;
  /** Cloudflare 账户 ID（仅用于 d1 驱动） */
  accountId?: string;
  /** Cloudflare 数据库 ID（仅用于 d1 驱动） */
  databaseId?: string;
  /** Cloudflare D1 访问令牌（仅用于 d1 驱动） */
  d1Token?: string;
}

/**
 * 数据库配置工厂函数
 *
 * 根据 DATABASE_DRIVER 环境变量选择合适的数据库配置。
 * 使用 NestJS 的 registerAs 将配置注册为可注入的服务。
 *
 * @returns 数据库配置对象
 */
export default registerAs('database', (): DatabaseConfig => {
  const driver = (process.env.DATABASE_DRIVER ?? 'local') as DatabaseDriver;

  switch (driver) {
    case 'turso':
      // Turso 云数据库配置
      return {
        driver,
        url: process.env.DATABASE_URL ?? '',
        authToken: process.env.DATABASE_AUTH_TOKEN,
      };
    case 'd1':
      // Cloudflare D1 数据库配置
      return {
        driver,
        url: process.env.DATABASE_URL ?? '',
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID,
        d1Token: process.env.CLOUDFLARE_D1_TOKEN,
      };
    case 'local':
    default:
      // 本地 SQLite 数据库配置
      return {
        driver: 'local',
        url: process.env.DATABASE_URL ?? 'file:./data/vanblog.db',
        filePath: process.env.DATABASE_FILE_PATH ?? './data/vanblog.db',
      };
  }
});
