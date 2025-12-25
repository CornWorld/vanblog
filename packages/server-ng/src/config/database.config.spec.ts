import databaseConfig, {
  type DatabaseDriver,
  DatabaseConfig as _DatabaseConfig,
} from './database.config';

describe('database.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('local driver', () => {
    it('should return local database config with default values', () => {
      delete process.env.DATABASE_DRIVER;
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_FILE_PATH;

      const config = databaseConfig();

      expect(config).toBeDefined();
      expect(config.driver).toBe('local');
      expect(config.url).toBe('file:./data/vanblog.db');
      expect(config.filePath).toBe('./data/vanblog.db');
      expect(config.authToken).toBeUndefined();
      expect(config.accountId).toBeUndefined();
      expect(config.databaseId).toBeUndefined();
      expect(config.d1Token).toBeUndefined();
    });

    it('should use custom DATABASE_URL for local driver', () => {
      process.env.DATABASE_DRIVER = 'local';
      process.env.DATABASE_URL = 'file:./custom/path.db';

      const config = databaseConfig();

      expect(config.driver).toBe('local');
      expect(config.url).toBe('file:./custom/path.db');
    });

    it('should use custom DATABASE_FILE_PATH for local driver', () => {
      process.env.DATABASE_DRIVER = 'local';
      process.env.DATABASE_FILE_PATH = './custom/path.db';

      const config = databaseConfig();

      expect(config.driver).toBe('local');
      expect(config.filePath).toBe('./custom/path.db');
    });

    it('should use both custom URL and filePath', () => {
      process.env.DATABASE_DRIVER = 'local';
      process.env.DATABASE_URL = 'file:./test.db';
      process.env.DATABASE_FILE_PATH = './test.db';

      const config = databaseConfig();

      expect(config.driver).toBe('local');
      expect(config.url).toBe('file:./test.db');
      expect(config.filePath).toBe('./test.db');
    });

    it('should default to local driver when invalid driver specified', () => {
      process.env.DATABASE_DRIVER = 'invalid-driver' as DatabaseDriver;

      const config = databaseConfig();

      expect(config.driver).toBe('local');
    });
  });

  describe('turso driver', () => {
    it('should return turso database config', () => {
      process.env.DATABASE_DRIVER = 'turso';
      process.env.DATABASE_URL = 'libsql://test.turso.io';
      process.env.DATABASE_AUTH_TOKEN = 'test-token-123';

      const config = databaseConfig();

      expect(config).toBeDefined();
      expect(config.driver).toBe('turso');
      expect(config.url).toBe('libsql://test.turso.io');
      expect(config.authToken).toBe('test-token-123');
      expect(config.filePath).toBeUndefined();
      expect(config.accountId).toBeUndefined();
      expect(config.databaseId).toBeUndefined();
      expect(config.d1Token).toBeUndefined();
    });

    it('should return empty URL if DATABASE_URL is not set', () => {
      process.env.DATABASE_DRIVER = 'turso';
      delete process.env.DATABASE_URL;

      const config = databaseConfig();

      expect(config.driver).toBe('turso');
      expect(config.url).toBe('');
    });

    it('should handle missing auth token', () => {
      process.env.DATABASE_DRIVER = 'turso';
      process.env.DATABASE_URL = 'libsql://test.turso.io';
      delete process.env.DATABASE_AUTH_TOKEN;

      const config = databaseConfig();

      expect(config.driver).toBe('turso');
      expect(config.authToken).toBeUndefined();
    });
  });

  describe('d1 driver', () => {
    it('should return d1 database config', () => {
      process.env.DATABASE_DRIVER = 'd1';
      process.env.DATABASE_URL =
        'https://api.cloudflare.com/client/v4/accounts/account-id/d1/database/db-id';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf-account-123';
      process.env.CLOUDFLARE_DATABASE_ID = 'cf-db-456';
      process.env.CLOUDFLARE_D1_TOKEN = 'cf-token-789';

      const config = databaseConfig();

      expect(config).toBeDefined();
      expect(config.driver).toBe('d1');
      expect(config.url).toBe(
        'https://api.cloudflare.com/client/v4/accounts/account-id/d1/database/db-id',
      );
      expect(config.accountId).toBe('cf-account-123');
      expect(config.databaseId).toBe('cf-db-456');
      expect(config.d1Token).toBe('cf-token-789');
      expect(config.filePath).toBeUndefined();
      expect(config.authToken).toBeUndefined();
    });

    it('should return empty URL if DATABASE_URL is not set', () => {
      process.env.DATABASE_DRIVER = 'd1';
      delete process.env.DATABASE_URL;

      const config = databaseConfig();

      expect(config.driver).toBe('d1');
      expect(config.url).toBe('');
    });

    it('should handle missing Cloudflare credentials', () => {
      process.env.DATABASE_DRIVER = 'd1';
      process.env.DATABASE_URL = 'https://api.cloudflare.com';
      delete process.env.CLOUDFLARE_ACCOUNT_ID;
      delete process.env.CLOUDFLARE_DATABASE_ID;
      delete process.env.CLOUDFLARE_D1_TOKEN;

      const config = databaseConfig();

      expect(config.driver).toBe('d1');
      expect(config.accountId).toBeUndefined();
      expect(config.databaseId).toBeUndefined();
      expect(config.d1Token).toBeUndefined();
    });

    it('should handle partial Cloudflare credentials', () => {
      process.env.DATABASE_DRIVER = 'd1';
      process.env.DATABASE_URL = 'https://api.cloudflare.com';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf-account';
      delete process.env.CLOUDFLARE_DATABASE_ID;
      delete process.env.CLOUDFLARE_D1_TOKEN;

      const config = databaseConfig();

      expect(config.driver).toBe('d1');
      expect(config.accountId).toBe('cf-account');
      expect(config.databaseId).toBeUndefined();
      expect(config.d1Token).toBeUndefined();
    });
  });

  describe('driver-specific field exclusivity', () => {
    it('should only include local-specific fields for local driver', () => {
      process.env.DATABASE_DRIVER = 'local';
      process.env.DATABASE_URL = 'file:./test.db';
      process.env.DATABASE_FILE_PATH = './test.db';
      // 设置其他驱动的环境变量，不应该被包含
      process.env.DATABASE_AUTH_TOKEN = 'should-not-appear';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'should-not-appear';

      const config = databaseConfig();

      expect(config.driver).toBe('local');
      expect(config.url).toBe('file:./test.db');
      expect(config.filePath).toBe('./test.db');
      // 确保其他驱动的字段不存在
      expect(config.authToken).toBeUndefined();
      expect(config.accountId).toBeUndefined();
    });

    it('should only include turso-specific fields for turso driver', () => {
      process.env.DATABASE_DRIVER = 'turso';
      process.env.DATABASE_URL = 'libsql://test.turso.io';
      process.env.DATABASE_AUTH_TOKEN = 'turso-token';
      // 设置其他驱动的环境变量，不应该被包含
      process.env.DATABASE_FILE_PATH = 'should-not-appear';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'should-not-appear';

      const config = databaseConfig();

      expect(config.driver).toBe('turso');
      expect(config.url).toBe('libsql://test.turso.io');
      expect(config.authToken).toBe('turso-token');
      // 确保其他驱动的字段不存在
      expect(config.filePath).toBeUndefined();
      expect(config.accountId).toBeUndefined();
    });

    it('should only include d1-specific fields for d1 driver', () => {
      process.env.DATABASE_DRIVER = 'd1';
      process.env.DATABASE_URL = 'https://api.cloudflare.com';
      process.env.CLOUDFLARE_ACCOUNT_ID = 'cf-account';
      process.env.CLOUDFLARE_DATABASE_ID = 'cf-db';
      process.env.CLOUDFLARE_D1_TOKEN = 'cf-token';
      // 设置其他驱动的环境变量，不应该被包含
      process.env.DATABASE_FILE_PATH = 'should-not-appear';
      process.env.DATABASE_AUTH_TOKEN = 'should-not-appear';

      const config = databaseConfig();

      expect(config.driver).toBe('d1');
      expect(config.url).toBe('https://api.cloudflare.com');
      expect(config.accountId).toBe('cf-account');
      expect(config.databaseId).toBe('cf-db');
      expect(config.d1Token).toBe('cf-token');
      // 确保其他驱动的字段不存在
      expect(config.filePath).toBeUndefined();
      expect(config.authToken).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string environment variables', () => {
      process.env.DATABASE_DRIVER = '';
      process.env.DATABASE_URL = '';

      const config = databaseConfig();

      // 空字符串应该默认到 local
      expect(config.driver).toBe('local');
    });

    it('should handle whitespace in environment variables', () => {
      process.env.DATABASE_DRIVER = 'local';
      process.env.DATABASE_URL = '  file:./test.db  ';

      const config = databaseConfig();

      expect(config.driver).toBe('local');
      expect(config.url).toBe('  file:./test.db  ');
    });

    it('should be case-sensitive for driver names', () => {
      process.env.DATABASE_DRIVER = 'LOCAL' as DatabaseDriver;

      const config = databaseConfig();

      // 'LOCAL' 不等于 'local'，应该默认到 local
      expect(config.driver).toBe('local');
    });
  });

  describe('configuration registration', () => {
    it('should be registered with namespace "database"', () => {
      const config = databaseConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should return consistent configuration for same environment', () => {
      process.env.DATABASE_DRIVER = 'local';
      process.env.DATABASE_URL = 'file:./consistent.db';

      const config1 = databaseConfig();
      const config2 = databaseConfig();

      expect(config1).toEqual(config2);
    });
  });
});
