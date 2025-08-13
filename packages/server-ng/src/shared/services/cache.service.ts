import { Injectable, Logger } from '@nestjs/common';

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * 缓存统计接口
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalSize: number;
  hitRate: number;
}

/**
 * 缓存配置接口
 */
interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
  enableStats: boolean;
}

/**
 * 高性能内存缓存服务
 * 支持 TTL、LRU 淘汰、统计信息等功能
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    totalSize: 0,
    hitRate: 0,
  };

  private readonly config: CacheConfig = {
    maxSize: 1000,
    defaultTtl: 5 * 60 * 1000, // 5分钟
    cleanupInterval: 60 * 1000, // 1分钟
    enableStats: true,
  };

  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * 获取缓存值
   */
  get(key: string): unknown {
    const entry = this.cache.get(key);

    if (!entry) {
      this.updateStats('miss');
      return null;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateStats('miss');
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    this.updateStats('hit');
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: unknown, ttl?: number): void {
    const now = Date.now();
    const actualTtl = ttl ?? this.config.defaultTtl;

    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<unknown> = {
      value,
      timestamp: now,
      ttl: actualTtl,
      accessCount: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.updateStats('set');
  }

  /**
   * 删除缓存值
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateStats('delete');
    }
    return deleted;
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      totalSize: this.cache.size,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
    this.stats.evictions = 0;
    this.stats.totalSize = 0;
    this.stats.hitRate = 0;
  }

  /**
   * 获取或设置缓存（如果不存在则执行回调函数）
   */
  async getOrSet<T>(key: string, factory: () => Promise<T> | T, ttl?: number): Promise<T> {
    const cached = this.get(key) as T | null;
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 批量获取缓存
   */
  mget<T>(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = this.get(key) as T | null;
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * 批量设置缓存
   */
  mset<T>(entries: Map<string, T>, ttl?: number): void {
    for (const [key, value] of entries) {
      this.set(key, value, ttl);
    }
  }

  /**
   * 获取所有缓存键
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存信息（用于调试）
   */
  getDebugInfo(): {
    config: CacheConfig;
    stats: CacheStats;
    entries: Array<{
      key: string;
      size: number;
      ttl: number;
      age: number;
      accessCount: number;
      timeSinceLastAccess: number;
    }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      size: JSON.stringify(entry.value).length,
      ttl: entry.ttl,
      age: now - entry.timestamp,
      accessCount: entry.accessCount,
      timeSinceLastAccess: now - entry.lastAccessed,
    }));

    return {
      config: this.config,
      stats: this.getStats(),
      entries,
    };
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * LRU 淘汰策略
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.updateStats('eviction');
      this.logger.debug(`Evicted LRU cache entry: ${oldestKey}`);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete' | 'eviction'): void {
    if (!this.config.enableStats) {
      return;
    }

    switch (operation) {
      case 'hit':
        this.stats.hits++;
        break;
      case 'miss':
        this.stats.misses++;
        break;
      case 'set':
        this.stats.sets++;
        break;
      case 'delete':
        this.stats.deletes++;
        break;
      case 'eviction':
        this.stats.evictions++;
        break;
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    let cleanedCount = 0;

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * 销毁服务时清理资源
   */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}
