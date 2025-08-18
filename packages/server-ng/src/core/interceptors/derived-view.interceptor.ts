import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, firstValueFrom } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { DerivedViewCacheService } from '../../shared/cache';
import {
  DERIVED_VIEW_METADATA,
  type DerivedViewOptions,
} from '../../shared/decorators/derived-view.decorator';

function safeToString(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.map((x) => safeToString(x)).join(',');
  if (typeof value === 'object') return JSON.stringify(value as Record<string, unknown>);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') {
    const desc = value.description ?? '';
    return desc.length > 0 ? `Symbol(${desc})` : 'Symbol()';
  }
  if (typeof value === 'function') return 'Function';
  // fallback for other primitive-like types
  return JSON.stringify(value);
}

/**
 * Linus 式派生视图拦截器 - 简单直接，零特殊情况
 *
 * 装饰器提供元数据；拦截器负责调用缓存服务
 */
@Injectable()
export class DerivedViewInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly derivedViewCache: DerivedViewCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const options = this.reflector.get<DerivedViewOptions | undefined>(
      DERIVED_VIEW_METADATA,
      handler,
    );

    // 若未使用装饰器，直接放行
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<{
      params?: Record<string, string | number | boolean | null | undefined>;
      query?: Record<string, unknown>;
    }>();

    // 构造缓存键：derived-view:<prefix>:<params&query...>
    const parts: (string | number)[] = [];

    const params = request.params ?? {};
    for (const k of Object.keys(params).sort()) {
      const v = params[k];
      parts.push(`${k}=${safeToString(v)}`);
    }

    const query = request.query ?? {};
    for (const k of Object.keys(query).sort()) {
      const v = query[k];
      if (v === undefined) continue;
      parts.push(`${k}=${safeToString(v)}`);
    }

    const key = DerivedViewCacheService.key(options.key, ...parts);

    // 使用缓存服务获取/生成派生视图
    return from(
      this.derivedViewCache.getDerivedView({
        key,
        generator: async (): Promise<unknown> => await firstValueFrom(next.handle()),
        ttl: options.ttl ?? 300,
        swr: options.swr ?? true,
        swrTolerance: options.swrTolerance ?? 60,
      }),
    ).pipe(switchMap((data: unknown) => from(Promise.resolve(data))));
  }
}
