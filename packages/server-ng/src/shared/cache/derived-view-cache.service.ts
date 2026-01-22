import { Injectable, Logger } from '@nestjs/common';
import { nowIsoTz, dayjs } from '@vanblog/shared/runtime';

import { CacheService } from './cache.service';

/**
 * Linus 式派生视图缓存服务 - SWR + ETag 的完美结合
 *
 * 核心原则：
 * 1. 任何派生视图都应该可缓存
 * 2. 数据陈旧时异步重新验证 (SWR)
 * 3. 零特殊情况，统一的接口
 * 4. ETag 由拦截器层自动处理
 */

export interface DerivedViewConfig {
  /** 缓存键前缀 */
  key: string;
  /** 数据生成函数 */
  generator: () => Promise<unknown>;
  /** TTL (秒) */
  ttl?: number;
  /** 是否启用 SWR */
  swr?: boolean;
  /** SWR 容忍的过期时间 (秒) */
  swrTolerance?: number;
}

export interface CacheMetadata {
  /** ISO 8601 timestamp string */
  timestamp: string;
  /** 是否正在重新生成 */
  regenerating: boolean;
}

export interface CachedResult<T = unknown> {
  data: T;
  meta: CacheMetadata;
}

@Injectable()
export class DerivedViewCacheService {
  private readonly logger = new Logger(DerivedViewCacheService.name);
  private readonly regeneratingKeys = new Set<string>();

  constructor(private readonly cacheService: CacheService) {}

  /**
   * 获取派生视图数据 - 核心 SWR 实现
   */
  async getDerivedView(config: DerivedViewConfig): Promise<unknown> {
    const { key, generator, ttl = 300, swr = true, swrTolerance = 60 } = config;

    // 尝试从缓存获取
    const cached = await this.getCachedResult(key);

    if (!cached) {
      // 缓存未命中，直接生成
      return this.generateAndCache(key, generator, ttl);
    }

    const { data, meta } = cached;
    const now = nowIsoTz();
    const age = dayjs(now).diff(dayjs(meta.timestamp), 'second');

    // 数据新鲜，直接返回
    if (age <= ttl) {
      return data;
    }

    // 数据过期
    if (!swr || age > ttl + swrTolerance) {
      // 超出 SWR 容忍度或未启用 SWR，同步重新生成
      return this.generateAndCache(key, generator, ttl);
    }

    // SWR 模式：返回旧数据，异步重新生成
    this.regenerateAsync(key, generator, ttl);
    return data;
  }

  /**
   * 生成并缓存数据
   */
  private async generateAndCache(
    key: string,
    generator: () => Promise<unknown>,
    ttl: number,
  ): Promise<unknown> {
    try {
      const data = await generator();
      const result: CachedResult = {
        data,
        meta: {
          timestamp: nowIsoTz(),
          regenerating: false,
        },
      };

      await this.cacheService.set(key, result, ttl + 60); // 额外 60 秒用于 SWR
      return data;
    } catch (error) {
      this.logger.error(`Failed to generate data for key ${key}:`, error as Error);
      throw error;
    }
  }

  /**
   * 异步重新生成数据 (SWR)
   */
  private regenerateAsync(key: string, generator: () => Promise<unknown>, ttl: number): void {
    // 防止重复触发重新生成
    if (this.regeneratingKeys.has(key)) {
      return;
    }

    this.regeneratingKeys.add(key);

    // 立即标记正在重新生成（同步）
    this.getCachedResult(key)
      .then((cached) => {
        if (cached) {
          cached.meta.regenerating = true;
          return this.cacheService.set(key, cached, ttl + 60);
        }
        return Promise.resolve();
      })
      .catch(() => {
        // Ignore errors during cache update
      });

    // 异步生成新数据
    this.generateAndCache(key, generator, ttl)
      .finally(() => {
        this.regeneratingKeys.delete(key);
      })
      .catch((error: unknown) => {
        this.logger.error(`Async regeneration failed for key ${key}:`, error as Error);
      });
  }

  /**
   * 获取缓存结果
   */
  private async getCachedResult(key: string): Promise<CachedResult | null> {
    return this.cacheService.get<CachedResult>(key);
  }

  /**
   * 使数据失效
   */
  async invalidate(key: string): Promise<void> {
    await this.cacheService.del(key);
  }

  /**
   * 检查数据是否正在重新生成
   */
  async isRegenerating(key: string): Promise<boolean> {
    const cached = await this.getCachedResult(key);
    return cached?.meta.regenerating ?? false;
  }

  /**
   * 生成派生视图缓存键
   */
  static key(prefix: string, ...parts: (string | number)[]): string {
    return CacheService.key('derived-view', prefix, ...parts);
  }
}
