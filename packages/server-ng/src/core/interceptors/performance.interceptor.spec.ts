import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { PerformanceInterceptor } from './performance.interceptor';

import type { LoggerService } from '../logger/logger.service';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

function createContext(req: Partial<Request>, res: Partial<Response>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as ExecutionContext;
}

function createCallHandler(data: unknown): CallHandler {
  return {
    handle: () => of(data),
  } as CallHandler;
}

function createErrorCallHandler(error: Error): CallHandler {
  return {
    handle: () => throwError(() => error),
  } as CallHandler;
}

describe('PerformanceInterceptor', () => {
  let interceptor: PerformanceInterceptor;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    interceptor = new PerformanceInterceptor(mockLogger);
  });

  it('should log normal requests in development environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req: Partial<Request> = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      headers: { 'user-agent': 'test-agent' },
    };
    const res: Partial<Response> = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next = createCallHandler({ success: true });

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toEqual({ success: true });
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringMatching(/GET \/api\/test 200 \d+ms \[127\.0\.0\.1\]/),
      'PerformanceInterceptor',
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should not log normal requests in production environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const req: Partial<Request> = {
      method: 'GET',
      url: '/api/test',
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
      headers: { 'user-agent': 'test-agent' },
    };
    const res: Partial<Response> = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next = createCallHandler({ success: true });

    await firstValueFrom(interceptor.intercept(ctx, next));

    expect(mockLogger.log).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('should warn about slow requests by mocking Date.now', async () => {
    const originalDateNow = Date.now;
    let callCount = 0;
    Date.now = vi.fn(() => {
      callCount++;
      return callCount === 1 ? 1000 : 2500; // 1.5 second difference
    });

    const req: Partial<Request> = {
      method: 'POST',
      url: '/api/slow',
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' } as any,
      headers: { 'user-agent': 'slow-client' },
    };
    const res: Partial<Response> = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next = createCallHandler({ data: 'slow' });

    await firstValueFrom(interceptor.intercept(ctx, next));

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /SLOW REQUEST: POST \/api\/slow 200 1500ms \[192\.168\.1\.1\] - UA: slow-client/,
      ),
      'PerformanceInterceptor',
    );

    Date.now = originalDateNow;
  });

  it('should log errors with stack trace', async () => {
    const testError = new Error('Test error');
    const req: Partial<Request> = {
      method: 'DELETE',
      url: '/api/error',
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' } as any,
      headers: { 'user-agent': 'error-client' },
    };
    const res: Partial<Response> = { statusCode: 500 };

    const ctx = createContext(req, res);
    const next = createErrorCallHandler(testError);

    try {
      await firstValueFrom(interceptor.intercept(ctx, next));
    } catch {
      // Expected to throw
    }

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE \/api\/error 500 \d+ms \[10\.0\.0\.1\] - ERROR: Test error/),
      testError.stack,
      'PerformanceInterceptor',
    );
  });

  it('should handle missing user-agent and IP gracefully', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req: Partial<Request> = {
      method: 'PATCH',
      url: '/api/minimal',
      socket: {} as any,
      headers: {},
    };
    const res: Partial<Response> = { statusCode: 204 };

    const ctx = createContext(req, res);
    const next = createCallHandler(null);

    const result = await firstValueFrom(interceptor.intercept(ctx, next));

    expect(result).toBeNull();
    expect(mockLogger.log).toHaveBeenCalledWith(
      expect.stringMatching(/PATCH \/api\/minimal 204 \d+ms \[unknown\]/),
      'PerformanceInterceptor',
    );

    process.env.NODE_ENV = originalEnv;
  });
});
