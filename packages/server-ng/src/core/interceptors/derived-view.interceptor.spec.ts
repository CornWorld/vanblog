import { firstValueFrom, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DerivedViewCacheService } from '../../shared/cache';

import { DerivedViewInterceptor } from './derived-view.interceptor';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

function createContext(req: Partial<Request>, _res?: Partial<Response>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req as Request,
      getResponse: () => ({}) as Response,
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

describe('DerivedViewInterceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass through when no DerivedView metadata', async () => {
    const reflector: Partial<Reflector> = { get: vi.fn().mockReturnValue(undefined) };

    const cacheGet = vi.fn();
    const cache = { getDerivedView: cacheGet } as unknown as DerivedViewCacheService;

    const interceptor = new DerivedViewInterceptor(reflector as Reflector, cache);

    const req: Partial<Request> = { method: 'GET', params: {}, query: {} };
    const ctx = createContext(req);

    const next = createCallHandler({ ok: true });

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual({ ok: true });
    expect(reflector.get as any).toHaveBeenCalled();
    expect(cacheGet).not.toHaveBeenCalled();
  });

  it('should build key from params and query (including normalized include) and call cache with options', async () => {
    const options = { key: 'overview', ttl: 120, swr: true, swrTolerance: 30 };
    const reflector: Partial<Reflector> = { get: vi.fn().mockReturnValue(options) };

    const cacheGet = vi.fn().mockResolvedValue('CACHED_DATA');
    const cache = { getDerivedView: cacheGet } as unknown as DerivedViewCacheService;

    const interceptor = new DerivedViewInterceptor(reflector as Reflector, cache);

    const req: Partial<Request> = {
      method: 'GET',
      params: { id: 5 as any, z: 'last', a: 'first' },
      query: { page: 2, include: 'b, a , a, c', flag: true, empty: undefined },
    } as any;
    const ctx = createContext(req);

    // Spy static key helper to validate parts passed
    const keySpy = vi.spyOn(DerivedViewCacheService, 'key');

    const next = createCallHandler({ from: 'next' });

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toBe('CACHED_DATA');

    // Validate key composition order and normalization
    expect(keySpy).toHaveBeenCalledWith(
      'overview',
      'a=first',
      'id=5',
      'z=last',
      'flag=true',
      'include=a,b,c',
      'page=2',
    );

    // Validate cache getDerivedView called with computed key and options
    expect(cacheGet).toHaveBeenCalledTimes(1);
    const [[arg]] = cacheGet.mock.calls;
    expect(arg.ttl).toBe(120);
    expect(arg.swr).toBe(true);
    expect(arg.swrTolerance).toBe(30);
    expect(typeof arg.generator).toBe('function');
  });

  it('should use next.handle() result via generator when cache requests it', async () => {
    const options = { key: 'k' };
    const reflector: Partial<Reflector> = { get: vi.fn().mockReturnValue(options) };

    const cacheGet = vi.fn().mockImplementation(async (cfg: any) => await cfg.generator());
    const cache = { getDerivedView: cacheGet } as unknown as DerivedViewCacheService;

    const interceptor = new DerivedViewInterceptor(reflector as Reflector, cache);

    const req: Partial<Request> = { method: 'GET', params: {}, query: {} };
    const ctx = createContext(req);

    const payload = { hello: 'world' };
    const next = createCallHandler(payload);

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual(payload);
    expect(cacheGet).toHaveBeenCalledTimes(1);
  });

  it('should normalize include when it is an array of CSV strings', async () => {
    const options = { key: 'k2' };
    const reflector: Partial<Reflector> = { get: vi.fn().mockReturnValue(options) };

    const cacheGet = vi.fn().mockResolvedValue('OK');
    const cache = { getDerivedView: cacheGet } as unknown as DerivedViewCacheService;
    const interceptor = new DerivedViewInterceptor(reflector as Reflector, cache);

    const req: Partial<Request> = {
      method: 'GET',
      params: {},
      query: { include: ['b,c', 'a', 'a, b', 'c'] },
    } as any;
    const ctx = createContext(req);

    const keySpy = vi.spyOn(DerivedViewCacheService, 'key');

    const next = createCallHandler('x');
    await firstValueFrom(interceptor.intercept(ctx, next));

    expect(keySpy).toHaveBeenCalledWith('k2', 'include=a,b,c');
  });

  it('should fallback to raw value when include is non-string non-array', async () => {
    const options = { key: 'k3' };
    const reflector: Partial<Reflector> = { get: vi.fn().mockReturnValue(options) };

    const cacheGet = vi.fn().mockResolvedValue('Y');
    const cache = { getDerivedView: cacheGet } as unknown as DerivedViewCacheService;
    const interceptor = new DerivedViewInterceptor(reflector as Reflector, cache);

    const req: Partial<Request> = {
      method: 'GET',
      params: {},
      query: { include: 123 as any },
    } as any;
    const ctx = createContext(req);

    const keySpy = vi.spyOn(DerivedViewCacheService, 'key');

    const next = createCallHandler('y');
    await firstValueFrom(interceptor.intercept(ctx, next));

    expect(keySpy).toHaveBeenCalledWith('k3', 'include=123');
  });
});
