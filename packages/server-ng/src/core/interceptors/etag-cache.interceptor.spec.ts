import { createHash } from 'crypto';

import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { createExecutionContextMock } from '@test/mock';

import { ETagCacheInterceptor } from './etag-cache.interceptor';

import type { CallHandler, ExecutionContext } from '@nestjs/common';

function createCallHandler(data: unknown): CallHandler {
  return {
    handle: () => of(data),
  } as CallHandler;
}

describe('ETagCacheInterceptor', () => {
  it('should pass through for non-GET methods without setting headers', async () => {
    const interceptor = new ETagCacheInterceptor();

    const setHeader = vi.fn();
    const status = vi.fn();

    const ctx = createExecutionContextMock({
      request: { method: 'POST', headers: {} },
      response: { setHeader, status } as any,
    }) as unknown as ExecutionContext;

    const next = createCallHandler({ ok: true });

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual({ ok: true });
    expect(setHeader).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('should set ETag and Cache-Control headers for GET response', async () => {
    const interceptor = new ETagCacheInterceptor();

    const setHeader = vi.fn();
    const status = vi.fn();

    const ctx = createExecutionContextMock({
      request: { method: 'GET', headers: {} },
      response: { setHeader, status } as any,
    }) as unknown as ExecutionContext;

    const body = { hello: 'world' };
    const next = createCallHandler(body);

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual(body);
    // Should set ETag and Cache-Control
    expect(setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^"[a-f0-9]{32}"$/));
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(status).not.toHaveBeenCalledWith(304);
  });

  it('should respond with 304 when If-None-Match matches generated ETag', async () => {
    const interceptor = new ETagCacheInterceptor();

    const setHeader = vi.fn();
    const status = vi.fn();

    const body = { value: 42 };
    const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;

    const ctx = createExecutionContextMock({
      request: { method: 'GET', headers: { 'if-none-match': etag } },
      response: { setHeader, status } as any,
    }) as unknown as ExecutionContext;

    const next = createCallHandler(body);

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    // Should set headers and then set status 304, returning null body
    expect(setHeader).toHaveBeenCalledWith('ETag', etag);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(status).toHaveBeenCalledWith(304);
    expect(result).toBeNull();
  });
});
