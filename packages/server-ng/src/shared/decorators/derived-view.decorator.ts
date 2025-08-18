import { SetMetadata } from '@nestjs/common';

/**
 * Linus 式派生视图装饰器 - 零配置，零特殊情况
 *
 * 核心原则：
 * 1. 装饰器只负责设置元数据
 * 2. 拦截器负责实际缓存逻辑
 * 3. 简单直接，无魔法
 */

export const DERIVED_VIEW_METADATA = 'derived-view';

export interface DerivedViewOptions {
  /** 缓存键前缀 */
  key: string;
  /** TTL (秒，默认 300) */
  ttl?: number;
  /** 是否启用 SWR (默认 true) */
  swr?: boolean;
  /** SWR 容忍的过期时间 (秒，默认 60) */
  swrTolerance?: number;
}

/**
 * 派生视图装饰器
 *
 * @example
 * ```typescript
 * @Get('timeline/:year')
 * @DerivedView({ key: 'timeline', ttl: 300, swr: true })
 * async getTimeline(@Param('year') year: number) {
 *   return this.articleService.getTimelineByYear(year);
 * }
 * ```
 */
export const DerivedView = (options: DerivedViewOptions): MethodDecorator =>
  SetMetadata(DERIVED_VIEW_METADATA, options);
