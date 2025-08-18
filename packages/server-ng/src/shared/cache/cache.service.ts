import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Inject } from '@nestjs/common';

import type { Cache } from 'cache-manager';

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
   *
   * 从缓存中获取指定键的值。如果键不存在或已过期，返回 null。
   * 支持泛型类型，确保返回值的类型安全。
   *
   * @param key 缓存键
   * @returns 缓存值或 null
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    return value ?? null;
  }

  /**
   * 设置缓存值
   *
   * 将值存储到缓存中，支持自定义过期时间。
   * 默认 TTL 为 5 分钟，适合大多数场景。
   *
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl TTL（秒），默认 5 分钟
   */
  async set(key: string, value: unknown, ttl = 300): Promise<void> {
    await this.cache.set(key, value, ttl * 1000); // 转换为毫秒
  }

  /**
   * 删除缓存
   *
   * 从缓存中删除指定键的值。如果键不存在，操作仍然成功。
   *
   * @param key 缓存键
   */
  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  /**
   * 清空所有缓存
   *
   * 删除缓存中的所有键值对。这是一个高影响操作，
   * 应谨慎使用，通常用于系统重置或调试。
   */
  async clear(): Promise<void> {
    await this.cache.clear();
  }

  /**
   * 缓存包装器
   *
   * 实现缓存穿透保护的核心方法。如果缓存命中则直接返回，
   * 否则执行提供的函数并将结果缓存。避免重复计算和数据库查询。
   *
   * @param key 缓存键
   * @param fn 当缓存未命中时执行的函数
   * @param ttl TTL（秒），默认 5 分钟
   * @returns 缓存值或函数执行结果
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
   * 生成缓存键
   *
   * 统一的键命名规范，使用冒号分隔各部分。
   * 确保键的一致性和可读性，避免键冲突。
   *
   * @param prefix 键前缀
   * @param parts 键的其他部分
   * @returns 格式化的缓存键
   * @example CacheService.key('user', 123) // 'user:123'
   */
  static key(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts].join(':');
  }
}
