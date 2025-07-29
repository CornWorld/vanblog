import { registerAs } from '@nestjs/config';

export type DatabaseDriver = 'local' | 'turso' | 'd1';

export interface DatabaseConfig {
  driver: DatabaseDriver;
  url: string;
  authToken?: string;
  // For local SQLite
  filePath?: string;
  // For Cloudflare D1
  accountId?: string;
  databaseId?: string;
  d1Token?: string;
}

export default registerAs('database', (): DatabaseConfig => {
  const driver = (process.env.DATABASE_DRIVER ?? 'local') as DatabaseDriver;

  switch (driver) {
    case 'turso':
      return {
        driver,
        url: process.env.DATABASE_URL ?? '',
        authToken: process.env.DATABASE_AUTH_TOKEN,
      };
    case 'd1':
      return {
        driver,
        url: process.env.DATABASE_URL ?? '',
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID,
        d1Token: process.env.CLOUDFLARE_D1_TOKEN,
      };
    case 'local':
    default:
      return {
        driver: 'local',
        url: process.env.DATABASE_URL ?? 'file:./data/vanblog.db',
        filePath: process.env.DATABASE_FILE_PATH ?? './data/vanblog.db',
      };
  }
});
