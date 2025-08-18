import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 连接池统计信息
 */
interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  maxWaitTime: number;
  connectionErrors: number;
  poolUtilization: number;
}

/**
 * 连接信息
 */
interface ConnectionInfo {
  id: string;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  queryCount: number;
  totalQueryTime: number;
}

/**
 * 连接池配置
 */
interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  healthCheckIntervalMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}

/**
 * 等待中的请求
 */
interface PendingRequest {
  resolve: (connection: ConnectionInfo) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * 数据库连接池优化服务
 *
 * 提供连接池管理、健康检查、性能监控等功能。支持连接复用、
 * 超时控制、自动清理和优雅关闭等特性。
 */
@Injectable()
export class ConnectionPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionPoolService.name);
  private readonly connections = new Map<string, ConnectionInfo>();
  private readonly pendingRequests: PendingRequest[] = [];
  private readonly stats: PoolStats = {
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
  };

  private readonly config: PoolConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      minConnections: this.configService.get<number>('DB_POOL_MIN', 2),
      maxConnections: this.configService.get<number>('DB_POOL_MAX', 10),
      acquireTimeoutMs: this.configService.get<number>('DB_ACQUIRE_TIMEOUT', 30000),
      idleTimeoutMs: this.configService.get<number>('DB_IDLE_TIMEOUT', 300000), // 5分钟
      maxLifetimeMs: this.configService.get<number>('DB_MAX_LIFETIME', 1800000), // 30分钟
      healthCheckIntervalMs: this.configService.get<number>('DB_HEALTH_CHECK_INTERVAL', 60000), // 1分钟
      retryAttempts: this.configService.get<number>('DB_RETRY_ATTEMPTS', 3),
      retryDelayMs: this.configService.get<number>('DB_RETRY_DELAY', 1000),
    };

    this.initialize();
  }

  /**
   * 初始化连接池
   */
  private initialize(): void {
    try {
      // 创建最小连接数
      for (let i = 0; i < this.config.minConnections; i++) {
        this.createConnection();
      }

      // 启动健康检查和清理定时器
      this.startHealthCheck();
      this.startCleanup();

      this.logger.log(`Connection pool initialized with ${this.config.minConnections} connections`);
    } catch (error) {
      this.logger.error('Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * 获取数据库连接
   *
   * 从连接池中获取一个可用的数据库连接。如果没有空闲连接且未达到最大连接数，
   * 则创建新连接。如果连接池已满，则等待直到有连接释放或超时。
   *
   * @returns 数据库连接信息
   * @throws Error 当获取连接超时或连接池已关闭时抛出异常
   */
  async acquireConnection(): Promise<ConnectionInfo> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.waitingRequests++;

    try {
      // 尝试获取空闲连接
      const idleConnection = this.getIdleConnection();
      if (idleConnection) {
        this.markConnectionActive(idleConnection);
        this.updateWaitTime(Date.now() - startTime);
        this.stats.successfulRequests++;
        this.stats.waitingRequests--;
        return idleConnection;
      }

      // 如果没有空闲连接且未达到最大连接数，创建新连接
      if (this.connections.size < this.config.maxConnections) {
        const newConnection = this.createConnection();
        this.markConnectionActive(newConnection);
        this.updateWaitTime(Date.now() - startTime);
        this.stats.successfulRequests++;
        this.stats.waitingRequests--;
        this.updateStats();
        return newConnection;
      }

      // 等待连接可用
      return await new Promise<ConnectionInfo>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = this.pendingRequests.findIndex((req) => req.resolve === resolve);
          if (index !== -1) {
            this.pendingRequests.splice(index, 1);
          }
          this.stats.failedRequests++;
          this.stats.waitingRequests--;
          reject(new Error(`Connection acquire timeout after ${this.config.acquireTimeoutMs}ms`));
        }, this.config.acquireTimeoutMs);

        this.pendingRequests.push({
          resolve: (connection) => {
            clearTimeout(timeout);
            this.updateWaitTime(Date.now() - startTime);
            this.stats.successfulRequests++;
            this.stats.waitingRequests--;
            resolve(connection);
          },
          reject: (error) => {
            clearTimeout(timeout);
            this.stats.failedRequests++;
            this.stats.waitingRequests--;
            reject(error);
          },
          timestamp: startTime,
        });
      });
    } catch (error) {
      this.stats.failedRequests++;
      this.stats.waitingRequests--;
      this.logger.error('Failed to acquire connection:', error);
      throw error;
    }
  }

  /**
   * 释放数据库连接
   *
   * 将使用完的数据库连接归还到连接池中，标记为空闲状态。
   * 如果有等待中的请求，会立即分配给下一个请求。
   *
   * @param connection 要释放的数据库连接
   */
  releaseConnection(connection: ConnectionInfo): void {
    if (!this.connections.has(connection.id)) {
      this.logger.warn(`Attempting to release unknown connection: ${connection.id}`);
      return;
    }

    this.markConnectionIdle(connection);

    // 处理等待中的请求
    if (this.pendingRequests.length > 0) {
      const pendingRequest = this.pendingRequests.shift();
      if (pendingRequest) {
        this.markConnectionActive(connection);
        pendingRequest.resolve(connection);
      }
    }
  }

  /**
   * 获取连接池统计信息
   *
   * 返回连接池的详细统计数据，包括连接数量、请求统计、
   * 等待时间和利用率等信息。
   *
   * @returns 连接池统计信息
   */
  getStats(): PoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取连接池配置
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }

  /**
   * 获取所有连接信息
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取连接池健康状态
   */
  /**
   * 获取连接池健康状态
   *
   * 检查连接池的健康状况，包括连接数量、利用率、等待时间等指标。
   * 提供问题诊断和优化建议。
   *
   * @returns 包含健康状态、问题列表和建议的对象
   */
  getHealthStatus(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 检查连接池利用率
    if (this.stats.poolUtilization > 90) {
      issues.push('High pool utilization (>90%)');
      recommendations.push('Consider increasing maxConnections');
    }

    // 检查等待请求数量
    if (this.stats.waitingRequests > 5) {
      issues.push('High number of waiting requests');
      recommendations.push('Consider increasing pool size or optimizing query performance');
    }

    // 检查平均等待时间
    if (this.stats.averageWaitTime > 1000) {
      issues.push('High average wait time (>1s)');
      recommendations.push('Consider optimizing connection acquisition or increasing pool size');
    }

    // 检查连接错误率
    const errorRate =
      this.stats.totalRequests > 0
        ? (this.stats.connectionErrors / this.stats.totalRequests) * 100
        : 0;
    if (errorRate > 5) {
      issues.push(`High connection error rate (${errorRate.toFixed(1)}%)`);
      recommendations.push('Check database connectivity and configuration');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * 强制关闭所有连接
   */
  /**
   * 强制关闭所有连接
   *
   * 立即关闭连接池中的所有连接，不等待正在进行的操作完成。
   * 通常在紧急情况下使用，可能导致正在进行的操作失败。
   */
  forceCloseAll(): void {
    this.logger.warn('Force closing all connections');

    // 拒绝所有等待中的请求
    while (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      if (request) {
        request.reject(new Error('Connection pool is being closed'));
      }
    }

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      this.closeConnection(connection);
    }

    this.connections.clear();
    this.updateStats();
  }

  /**
   * 优雅关闭连接池
   */
  /**
   * 优雅关闭连接池
   *
   * 停止接受新的连接请求，等待现有连接完成操作后关闭。
   * 如果在指定时间内无法完成，则强制关闭剩余连接。
   *
   * @param timeoutMs 等待超时时间（毫秒），默认 30 秒
   */
  async gracefulShutdown(timeoutMs = 30000): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log('Starting graceful shutdown of connection pool');

    const startTime = Date.now();

    // 等待所有活跃连接完成
    while (this.stats.activeConnections > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.updateStats();
    }

    if (this.stats.activeConnections > 0) {
      this.logger.warn(
        `Timeout reached, force closing ${this.stats.activeConnections} active connections`,
      );
    }

    this.forceCloseAll();
    this.logger.log('Connection pool shutdown completed');
  }

  /**
   * 创建新连接
   */
  private createConnection(): ConnectionInfo {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    try {
      // 这里应该创建实际的数据库连接
      // 由于我们使用 Drizzle ORM，这个方法主要用于连接池管理和监控

      const connection: ConnectionInfo = {
        id: connectionId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: false,
        queryCount: 0,
        totalQueryTime: 0,
      };

      this.connections.set(connectionId, connection);

      this.logger.debug(`Created new connection: ${connectionId}`);
      return connection;
    } catch (error) {
      this.stats.connectionErrors++;
      this.logger.error(`Failed to create connection: ${String(error)}`);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  private closeConnection(connection: ConnectionInfo): void {
    try {
      // 这里应该关闭实际的数据库连接
      this.connections.delete(connection.id);
      this.logger.debug(`Closed connection: ${connection.id}`);
    } catch (error) {
      this.logger.error(`Failed to close connection ${connection.id}:`, error);
    }
  }

  /**
   * 获取空闲连接
   */
  private getIdleConnection(): ConnectionInfo | null {
    for (const connection of this.connections.values()) {
      if (!connection.isActive) {
        return connection;
      }
    }
    return null;
  }

  /**
   * 标记连接为活跃状态
   */
  private markConnectionActive(connection: ConnectionInfo): void {
    connection.isActive = true;
    connection.lastUsed = Date.now();
  }

  /**
   * 标记连接为空闲状态
   */
  private markConnectionIdle(connection: ConnectionInfo): void {
    connection.isActive = false;
    connection.lastUsed = Date.now();
  }

  /**
   * 更新等待时间统计
   */
  private updateWaitTime(waitTime: number): void {
    if (waitTime > this.stats.maxWaitTime) {
      this.stats.maxWaitTime = waitTime;
    }

    // 计算移动平均值
    const alpha = 0.1; // 平滑因子
    this.stats.averageWaitTime = this.stats.averageWaitTime * (1 - alpha) + waitTime * alpha;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalConnections = this.connections.size;
    this.stats.activeConnections = Array.from(this.connections.values()).filter(
      (c) => c.isActive,
    ).length;
    this.stats.idleConnections = this.connections.size - this.stats.activeConnections;
    this.stats.waitingRequests = this.pendingRequests.length;
    this.stats.poolUtilization =
      this.config.maxConnections > 0
        ? (this.connections.size / this.config.maxConnections) * 100
        : 0;
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const connectionsToClose: ConnectionInfo[] = [];

    for (const connection of this.connections.values()) {
      // 检查连接是否超过最大生命周期
      if (now - connection.createdAt > this.config.maxLifetimeMs) {
        if (!connection.isActive) {
          connectionsToClose.push(connection);
        }
      }

      // 检查空闲连接是否超时
      if (!connection.isActive && now - connection.lastUsed > this.config.idleTimeoutMs) {
        if (this.connections.size > this.config.minConnections) {
          connectionsToClose.push(connection);
        }
      }
    }

    // 关闭需要清理的连接
    for (const connection of connectionsToClose) {
      this.closeConnection(connection);
    }

    // 确保最小连接数
    while (this.connections.size < this.config.minConnections) {
      try {
        this.createConnection();
      } catch (error) {
        this.logger.error('Failed to maintain minimum connections:', error);
        break;
      }
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.updateStats();
    }, 10000); // 每10秒更新一次统计信息
  }

  /**
   * 模块销毁时的清理
   */
  /**
   * 模块销毁时的清理操作
   *
   * NestJS 生命周期钩子，在模块销毁时自动调用。
   * 执行优雅关闭流程，清理所有资源。
   */
  async onModuleDestroy(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    await this.gracefulShutdown();
  }
}
