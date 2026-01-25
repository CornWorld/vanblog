import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { V1DeprecationMiddleware } from './v1-deprecation.middleware';

import type { LoggerService } from '../logger/logger.service';
import type { Request, Response, NextFunction } from 'express';

describe('V1DeprecationMiddleware', () => {
  let middleware: V1DeprecationMiddleware;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
    } as unknown as LoggerService;

    middleware = new V1DeprecationMiddleware(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw 410 Gone and log for v1 public endpoint with migration suggestion', () => {
    const req = {
      originalUrl: '/api/v1/public/searchArticle?keyword=abc&page=1',
      method: 'GET',
      ip: '127.0.0.1',
    } as unknown as Request;

    const next = vi.fn() as unknown as NextFunction;

    try {
      middleware.use(req, {} as Response, next);
      // If no exception thrown, fail
      expect.unreachable('Expected HttpException to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(HttpStatus.GONE);
      const body = ex.getResponse() as any;
      expect(body).toMatchObject({
        statusCode: HttpStatus.GONE,
        error: 'Gone',
        message: 'V1 API has been permanently removed',
        details: {
          deprecatedEndpoint: '/api/v1/public/searchArticle?keyword=abc&page=1',
          documentation: '/api/docs',
        },
      });
      expect(body.details.migrationGuide).toContain(
        'GET /api/v2/articles/search?keyword={keyword}&page={page}&limit={limit}',
      );
      expect((mockLogger as any).warn).toHaveBeenCalled();
    }
  });

  it('should throw 410 Gone and provide auth migration suggestion', () => {
    const req = {
      originalUrl: '/api/v1/auth/login',
      method: 'POST',
      ip: '127.0.0.1',
    } as unknown as Request;

    const next = vi.fn() as unknown as NextFunction;

    try {
      middleware.use(req, {} as Response, next);
      expect.unreachable('Expected HttpException to be thrown');
    } catch (e) {
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(HttpStatus.GONE);
      const body = ex.getResponse() as any;
      expect(body.details.migrationGuide).toContain('POST /api/v2/auth/login');
      expect((mockLogger as any).warn).toHaveBeenCalled();
    }
  });

  it('should call next for non-v1 path', () => {
    const req = {
      originalUrl: '/api/v2/articles',
      method: 'GET',
    } as unknown as Request;

    const next = vi.fn();

    middleware.use(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((mockLogger as any).warn).not.toHaveBeenCalled();
  });
});
