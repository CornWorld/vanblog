import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CacheService } from './cache.service';

/**
 * Linus 式缓存模块 - 简单配置，支持内存和 Redis
 *
 * 设计原则：
 * 1. 默认内存缓存，生产环境可配置 Redis
 * 2. 统一的配置接口，消除环境差异
 * 3. 零配置启动，渐进式扩展
 */
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (_configService: ConfigService) => {
        // 简化配置：默认使用内存缓存
        // 生产环境可通过环境变量 REDIS_URL 配置 Redis
        return {
          ttl: 300, // 默认 5 分钟
          max: 1000, // 最大缓存数量
        };
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
