import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { ConnectionPoolService } from './connection-pool.service';

describe('ConnectionPoolService', () => {
  let service: ConnectionPoolService;

  beforeEach(async () => {
    const mockConfigService = {
      get: vi.fn((key: string, defaultValue?: number) => {
        const config: Record<string, number> = {
          DB_POOL_MIN: 2,
          DB_POOL_MAX: 10,
          DB_ACQUIRE_TIMEOUT: 5000,
          DB_IDLE_TIMEOUT: 30000,
          DB_MAX_LIFETIME: 300000,
          DB_HEALTH_CHECK_INTERVAL: 60000,
          DB_RETRY_ATTEMPTS: 3,
          DB_RETRY_DELAY: 1000,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionPoolService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ConnectionPoolService>(ConnectionPoolService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfig', () => {
    it('should return pool configuration', () => {
      const config = service.getConfig();
      expect(config).toEqual({
        minConnections: 2,
        maxConnections: 10,
        acquireTimeoutMs: 5000,
        idleTimeoutMs: 30000,
        maxLifetimeMs: 300000,
        healthCheckIntervalMs: 60000,
        retryAttempts: 3,
        retryDelayMs: 1000,
      });
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = service.getStats();
      expect(stats).toEqual({
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageWaitTime: 0,
        maxWaitTime: 0,
        connectionErrors: 0,
        poolUtilization: 0,
      });
    });
  });

  describe('getConnections', () => {
    it('should return empty array initially', () => {
      const connections = service.getConnections();
      expect(connections).toEqual([]);
    });
  });

  describe('acquireConnection', () => {
    it('should create new connection when pool is empty', async () => {
      const connection = await service.acquireConnection();

      expect(connection).toBeDefined();
      expect(connection.id).toBeDefined();
      expect(connection.isActive).toBe(true);
      expect(connection.createdAt).toBeGreaterThan(0);
      expect(connection.queryCount).toBe(0);
      expect(connection.totalQueryTime).toBe(0);

      const stats = service.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.successfulRequests).toBe(1);
    });

    it('should reuse idle connection', async () => {
      const connection1 = await service.acquireConnection();
      service.releaseConnection(connection1);

      const connection2 = await service.acquireConnection();

      expect(connection2.id).toBe(connection1.id);
      expect(connection2.isActive).toBe(true);

      const stats = service.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.activeConnections).toBe(1);
      expect(stats.idleConnections).toBe(0);
    });

    it('should create multiple connections up to max limit', async () => {
      const connections = [];
      const config = service.getConfig();
      const { maxConnections } = config;

      for (let i = 0; i < maxConnections; i++) {
        const connection = await service.acquireConnection();
        connections.push(connection);
      }

      const stats = service.getStats();
      expect(stats.totalConnections).toBe(10);
      expect(stats.activeConnections).toBe(10);

      // Clean up
      for (const conn of connections) {
        service.releaseConnection(conn);
      }
    });

    it('should throw error when shutting down', async () => {
      await service.gracefulShutdown(100);

      await expect(service.acquireConnection()).rejects.toThrow('Connection pool is shutting down');
    });
  });

  describe('releaseConnection', () => {
    it('should mark connection as idle', async () => {
      const connection = await service.acquireConnection();
      expect(connection.isActive).toBe(true);

      service.releaseConnection(connection);
      expect(connection.isActive).toBe(false);

      const stats = service.getStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(1);
    });

    it('should handle unknown connection gracefully', () => {
      const fakeConnection = {
        id: 'fake-id',
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
        queryCount: 0,
        totalQueryTime: 0,
      };

      expect(() => {
        service.releaseConnection(fakeConnection);
      }).not.toThrow();
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for normal pool', () => {
      const health = service.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.issues).toEqual([]);
      expect(health.recommendations).toEqual([]);
    });

    it('should detect high utilization', async () => {
      const { maxConnections } = service.getConfig();
      const connections = [];

      // Use more than 90% of connections to trigger health issues
      for (let i = 0; i < maxConnections; i++) {
        const connection = await service.acquireConnection();
        connections.push(connection);
      }

      // Force stats update before health check
      service.getStats();
      const health = service.getHealthStatus();
      expect(health.issues.length).toBeGreaterThan(0);
      expect(health.recommendations.length).toBeGreaterThan(0);

      // Clean up
      for (const conn of connections) {
        service.releaseConnection(conn);
      }
    });
  });

  describe('forceCloseAll', () => {
    it('should close all connections', async () => {
      await service.acquireConnection();
      await service.acquireConnection();

      service.forceCloseAll();

      const stats = service.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.idleConnections).toBe(0);
    });
  });

  describe('gracefulShutdown', () => {
    it('should shutdown gracefully', async () => {
      const connection = await service.acquireConnection();
      service.releaseConnection(connection);

      await expect(service.gracefulShutdown(1000)).resolves.not.toThrow();

      const stats = service.getStats();
      expect(stats.totalConnections).toBe(0);
    });

    it('should timeout if connections are not released', async () => {
      await service.acquireConnection();
      // Don't release the connection

      const startTime = Date.now();
      await service.gracefulShutdown(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('connection lifecycle', () => {
    it('should track connection usage', async () => {
      const connection = await service.acquireConnection();

      expect(connection.queryCount).toBe(0);
      expect(connection.totalQueryTime).toBe(0);
      expect(connection.lastUsed).toBeGreaterThan(0);

      service.releaseConnection(connection);
    });

    it('should update last used time on release', async () => {
      const connection = await service.acquireConnection();
      const initialLastUsed = connection.lastUsed;

      // Wait a bit
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      service.releaseConnection(connection);
      expect(connection.lastUsed).toBeGreaterThan(initialLastUsed);
    });
  });

  describe('stats tracking', () => {
    it('should track request statistics', async () => {
      const connection1 = await service.acquireConnection();
      const connection2 = await service.acquireConnection();

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);

      service.releaseConnection(connection1);
      service.releaseConnection(connection2);
    });

    it('should calculate pool utilization', async () => {
      const connection = await service.acquireConnection();

      const stats = service.getStats();
      const expectedUtilization = (1 / service.getConfig().maxConnections) * 100;
      expect(stats.poolUtilization).toBe(expectedUtilization);

      service.releaseConnection(connection);
    });
  });
});
