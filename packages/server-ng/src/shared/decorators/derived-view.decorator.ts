import { SetMetadata } from '@nestjs/common';

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
 * @description
 * 零配置，零特殊情况。
 * 拦截器在请求进入时构建 cache key → 通过派生视图缓存服务获取/生成数据 → 最终响应由 ETag 拦截器注入 ETag 并处理 304。
 *
 * @param {object} options - 派生视图的配置选项
 * @param {string} options.key - 缓存键的前缀，用于唯一标识缓存项
 * @param {number} [options.ttl=300] - 缓存的生存时间 (Time-To-Live)，单位为秒。默认值为 300 秒
 * @param {boolean} [options.swr=true] - 是否启用 Stale-While-Revalidate (SWR) 机制
 *   启用后，即使缓存过期，在重新获取新数据的同时，也会立即返回旧的缓存数据。默认值为 true
 * @param {number} [options.swrTolerance=60] - SWR 机制中，允许返回过期数据的容忍时间，单位为秒。
 *   仅在 `swr` 为 `true` 时生效。默认值为 60 秒
 */
export const DerivedView = (options: DerivedViewOptions): MethodDecorator =>
  SetMetadata(DERIVED_VIEW_METADATA, options);
