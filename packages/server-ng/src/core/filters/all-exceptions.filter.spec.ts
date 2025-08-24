import { HttpException, HttpStatus, type ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter';

import type { LoggerService } from '../logger/logger.service';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockLogger: LoggerService;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let mockRequest: { url: string; method: string };

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
    } as unknown as LoggerService;

    mockRequest = { url: '/api/test', method: 'GET' };
    mockResponse = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    mockArgumentsHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue(mockResponse),
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    filter = new AllExceptionsFilter(mockLogger);
  });

  it('should handle HttpException and return structured response', () => {
    const exception = new HttpException({ message: 'boom', extra: 1 }, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'boom',
      extra: 1,
    });
    expect((mockLogger as any).error).toHaveBeenCalled();
  });

  it('should handle HttpException with string message (fallback payload)', () => {
    const exception = new HttpException('boom', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'boom',
    });
    expect((mockLogger as any).error).toHaveBeenCalled();
  });

  it('should handle non-Error unknown exception and respond 500', () => {
    const unknown: any = { foo: 'bar' };

    filter.catch(unknown, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const calls = (mockResponse.json as any).mock.calls as any[];
    expect(calls.length).toBeGreaterThan(0);
    const [lastCall] = calls.slice(-1);
    const [payload] = lastCall;
    expect(payload).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path: '/api/test',
      method: 'GET',
    });
    expect((mockLogger as any).error).toHaveBeenCalled();
  });

  it('should handle generic Error and include stack only in development', () => {
    const originalEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';
      const err = new Error('kaboom');
      filter.catch(err, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const callsProd = (mockResponse.json as any).mock.calls as any[];
      expect(callsProd.length).toBeGreaterThan(0);
      const [lastProdCall] = callsProd.slice(-1);
      const [prodPayload] = lastProdCall;
      expect(prodPayload).toMatchObject({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        path: '/api/test',
        method: 'GET',
        message: 'kaboom',
        name: 'Error',
      });
      expect(prodPayload.stack).toBeUndefined();

      // Now development should include stack
      process.env.NODE_ENV = 'development';
      const errDev = new Error('kaboom');
      filter.catch(errDev, mockArgumentsHost);

      const callsDev = (mockResponse.json as any).mock.calls as any[];
      expect(callsDev.length).toBeGreaterThan(0);
      const [lastDevCall] = callsDev.slice(-1);
      const [devPayload] = lastDevCall;
      expect(devPayload.message).toBe('kaboom');
      expect(typeof devPayload.stack === 'string' && devPayload.stack.length > 0).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
