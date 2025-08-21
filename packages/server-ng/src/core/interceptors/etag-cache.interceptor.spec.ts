import { createHash } from 'crypto';

import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ETagCacheInterceptor } from './etag-cache.interceptor';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

function createContext(req: Partial<Request>, res: Partial<Response>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req as Request,
      getResponse: () => res as Response,
    }),
    getClass: () => ({}) as any,
    getHandler: () => ({}) as any,
    getArgByIndex: () => undefined as any,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getArgs: () => [],
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

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

    const req: Partial<Request> = { method: 'POST', headers: {} };
    const res: Partial<Response> = { setHeader, status } as any;

    const ctx = createContext(req, res);
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

    const req: Partial<Request> = { method: 'GET', headers: {} };
    const res: Partial<Response> = { setHeader, status } as any;

    const ctx = createContext(req, res);
    const body = { hello: 'world' };
    const next = createCallHandler(body);

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual(body);
    // Should set ETag and Cache-Control
    expect(setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^"[a-f0-9]{32}"$/));
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60, must-revalidate');
    expect(status).not.toHaveBeenCalledWith(304);
  });

  it('should respond with 304 when If-None-Match matches generated ETag', async () => {
    const interceptor = new ETagCacheInterceptor();

    const setHeader = vi.fn();
    const status = vi.fn();

    const body = { value: 42 };
    const etag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;

    const req: Partial<Request> = { method: 'GET', headers: { 'if-none-match': etag } };
    const res: Partial<Response> = { setHeader, status } as any;

    const ctx = createContext(req, res);
    const next = createCallHandler(body);

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    // Should set headers and then set status 304, returning null body
    expect(setHeader).toHaveBeenCalledWith('ETag', etag);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=60, must-revalidate');
    expect(status).toHaveBeenCalledWith(304);
    expect(result).toBeNull();
  });
});
