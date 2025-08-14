import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Linus 式缓存服务 - 简单、直接、无特殊情况
 *
 * 核心原则：
 * 1. 统一的缓存接口，消除不同存储方式的特殊处理
 * 2. 简单的 TTL 管理，避免复杂的过期策略
 * 3. 类型安全的缓存操作
 */
@Injectable()
export class CacheService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    return value ?? null;
  }

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl TTL（秒），默认 5 分钟
   */
  async set(key: string, value: unknown, ttl = 300): Promise<void> {
    await this.cache.set(key, value, ttl * 1000); // 转换为毫秒
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * 缓存包装器 - 如果缓存不存在则执行函数并缓存结果
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * 生成缓存键 - 统一的键命名规范
   */
  static key(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts].join(':');
  }
}
