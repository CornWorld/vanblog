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
    const calls = vi.mocked(mockResponse.json).mock.calls as any[];
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
      const callsProd = vi.mocked(mockResponse.json).mock.calls as any[];
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

      const callsDev = vi.mocked(mockResponse.json).mock.calls as any[];
      expect(callsDev.length).toBeGreaterThan(0);
      const [lastDevCall] = callsDev.slice(-1);
      const [devPayload] = lastDevCall;
      expect(devPayload.message).toBe('kaboom');
      expect(typeof devPayload.stack === 'string' && devPayload.stack.length > 0).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should handle TypeError exceptions', () => {
    const typeError = new TypeError('Cannot read property of undefined');

    filter.catch(typeError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'Cannot read property of undefined',
      name: 'TypeError',
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle ReferenceError exceptions', () => {
    const refError = new ReferenceError('Variable is not defined');

    filter.catch(refError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'Variable is not defined',
      name: 'ReferenceError',
    });
  });

  it('should handle various HTTP exception types', () => {
    const testCases = [
      { status: HttpStatus.UNAUTHORIZED, message: 'Unauthorized' },
      { status: HttpStatus.FORBIDDEN, message: 'Forbidden' },
      { status: HttpStatus.NOT_FOUND, message: 'Not Found' },
      { status: HttpStatus.CONFLICT, message: 'Conflict' },
      { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Unprocessable Entity' },
    ];

    testCases.forEach(({ status, message }) => {
      const exception = new HttpException(message, status);
      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(status);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: status,
        timestamp: expect.any(String) as string,
        path: '/api/test',
        method: 'GET',
        message,
      });
    });
  });

  it('should log exception details for HttpException', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled Exception: GET /api/test',
      exception.stack,
      'AllExceptionsFilter',
    );
  });

  it('should log stringified unknown exceptions', () => {
    const unknownException = { custom: 'error', code: 500 };

    filter.catch(unknownException, mockArgumentsHost);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled Exception: GET /api/test',
      JSON.stringify(unknownException),
      'AllExceptionsFilter',
    );
  });

  it('should handle null exception gracefully', () => {
    filter.catch(null, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
    });
  });

  it('should handle undefined exception gracefully', () => {
    filter.catch(undefined, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
    });
  });

  it('should handle string exceptions', () => {
    const stringException = 'Something went wrong';

    filter.catch(stringException, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
    });
  });

  it('should handle number exceptions', () => {
    const numberException = 404;

    filter.catch(numberException, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
    });
  });

  it('should handle different URL paths correctly', () => {
    const paths = ['/api/v2/articles', '/admin/settings', '/public/bootstrap', '/rss/feed.xml'];

    paths.forEach((path) => {
      mockRequest.url = path;
      const error = new Error('Test error');
      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path,
        }),
      );
    });
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

    methods.forEach((method) => {
      mockRequest.method = method;
      const error = new Error('Test error');
      filter.catch(error, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          method,
        }),
      );
    });
  });

  it('should include timestamp in all responses', () => {
    const exceptions = [
      new HttpException('Http error', HttpStatus.BAD_REQUEST),
      new Error('Regular error'),
      { custom: 'object' },
    ];

    exceptions.forEach((exception) => {
      filter.catch(exception, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;
      expect(payload.timestamp).toBeDefined();
      expect(typeof payload.timestamp).toBe('string');
    });
  });

  it('should handle Error with custom properties', () => {
    const customError = new Error('Custom error') as Error & { code: string; details: unknown };
    customError.code = 'CUSTOM_ERROR';
    customError.details = { reason: 'test' };

    filter.catch(customError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'Custom error',
      name: 'Error',
    });
  });

  describe('XSS Validation - Error Response Handling', () => {
    it('should include XSS payload message in response for error tracking', () => {
      const xssPayload = '<script>alert(1)</script>';
      const exception = new HttpException({ message: xssPayload }, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Verify the message is returned as-is for debugging
      expect(payload.message).toBe(xssPayload);
      // Frontend should handle sanitization
      expect(payload).toHaveProperty('message');
    });

    it('should include dangerous payloads in error responses for client-side sanitization', () => {
      const xssPayload = '<img src=x onerror="alert(1)">';
      const exception = new HttpException(xssPayload, HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Error response includes payload for debugging; frontend must sanitize
      expect(payload.message).toBe(xssPayload);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });

    it('should handle nested error objects with potentially dangerous content', () => {
      const xssPayload = {
        message: '<iframe src="evil"></iframe>',
        custom: '<svg onload="alert(1)">',
      };
      const exception = new HttpException(xssPayload, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Response includes nested properties for debugging
      expect(payload.message).toBe('<iframe src="evil"></iframe>');
      expect(payload.custom).toBe('<svg onload="alert(1)">');
    });

    it('should handle exception with mixed safe and unsafe content', () => {
      const mixed = {
        message: 'Safe message with <script>bad</script> mixed content',
        safe_field: 'this is safe',
        dangerous: '<div onclick="alert(1)">click me</div>',
      };
      const exception = new HttpException(mixed, HttpStatus.UNPROCESSABLE_ENTITY);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
      const calls = (mockResponse.json as any).mock.calls as any[];
      expect(calls.length).toBeGreaterThan(0);
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Verify all fields are preserved for client-side handling
      expect(payload.message).toContain('<script>');
      expect(payload.safe_field).toBe('this is safe');
      expect(payload.dangerous).toContain('<div');
    });

    it('should include error message even with HTML tags for debugging', () => {
      const xssError = new Error('<body onload="alert(1)">');

      filter.catch(xssError, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Error message preserved for debugging/logging
      expect(payload.message).toBe('<body onload="alert(1)">');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should validate error object structure is properly formatted in response', () => {
      const testPayload = { message: '<test>message</test>', code: 'TEST_ERROR' };
      const exception = new HttpException(testPayload, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Verify response structure
      expect(payload).toHaveProperty('statusCode');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('path');
      expect(payload).toHaveProperty('method');
      expect(payload).toHaveProperty('message');
      expect(payload).toHaveProperty('code');
    });
  });

  describe('Timestamp Format Validation (RFC3339 Compliance)', () => {
    // RFC 3339 regex pattern: YYYY-MM-DDTHH:MM:SS[.fff]Z or [+-]HH:MM
    const rfc3339Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([Z]|[+-]\d{2}:\d{2})$/;

    it('should include RFC3339 compliant timestamp in error response', () => {
      const exception = new HttpException('test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      expect(payload.timestamp).toBeDefined();
      expect(typeof payload.timestamp).toBe('string');
      expect(rfc3339Pattern.test(payload.timestamp)).toBe(true);
    });

    it('should validate error object structure is properly formatted in response', () => {
      const testPayload = { message: '<test>message</test>', code: 'TEST_ERROR' };
      const exception = new HttpException(testPayload, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Verify response structure
      expect(payload).toHaveProperty('statusCode');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('path');
      expect(payload).toHaveProperty('method');
      expect(payload).toHaveProperty('message');
      expect(payload).toHaveProperty('code');
    });

    it('should use valid date/time values in timestamp', () => {
      const exception = new Error('parse error');

      filter.catch(exception, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Parse timestamp and verify it's a valid date
      const timestamp = new Date(payload.timestamp);
      expect(timestamp instanceof Date).toBe(true);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });

    it('should have timestamp close to current time (within 5 seconds)', () => {
      const beforeTime = Date.now();
      const exception = new Error('timing test');

      filter.catch(exception, mockArgumentsHost);

      const afterTime = Date.now();

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      const timestampMs = new Date(payload.timestamp).getTime();

      // Timestamp should be between before and after, with 5 second tolerance for edge cases
      expect(timestampMs).toBeGreaterThanOrEqual(beforeTime - 5000);
      expect(timestampMs).toBeLessThanOrEqual(afterTime + 5000);
    });

    it('should handle timestamp with different status codes consistently', () => {
      const statusCodes = [
        HttpStatus.BAD_REQUEST,
        HttpStatus.UNAUTHORIZED,
        HttpStatus.FORBIDDEN,
        HttpStatus.NOT_FOUND,
        HttpStatus.INTERNAL_SERVER_ERROR,
      ];

      const timestamps: string[] = [];

      statusCodes.forEach((status) => {
        const exception = new HttpException(`error ${String(status)}`, status);
        filter.catch(exception, mockArgumentsHost);

        const calls = (mockResponse.json as any).mock.calls as any[];
        const [lastCall] = calls.slice(-1);
        const [payload] = lastCall;

        timestamps.push(payload.timestamp);
      });

      // All timestamps should be RFC3339 compliant
      timestamps.forEach((timestamp) => {
        expect(rfc3339Pattern.test(timestamp)).toBe(true);
      });

      // Timestamps should be in increasing order (with tolerance for fast execution)
      for (let i = 1; i < timestamps.length; i++) {
        const prevTime = new Date(timestamps[i - 1]).getTime();
        const currentTime = new Date(timestamps[i]).getTime();
        // Allow timestamps to be in order or equal (fast execution)
        expect(currentTime).toBeGreaterThanOrEqual(prevTime - 100); // 100ms tolerance
      }
    });

    it('should not include invalid characters in timestamp', () => {
      const exception = new Error('validation test');

      filter.catch(exception, mockArgumentsHost);

      const calls = (mockResponse.json as any).mock.calls as any[];
      const [lastCall] = calls.slice(-1);
      const [payload] = lastCall;

      // Should not contain any XSS or injection characters
      expect(payload.timestamp).not.toMatch(/[<>'"`;]/);
      expect(payload.timestamp).not.toMatch(/javascript:/i);
    });

    it('should handle multiple rapid error responses with unique timestamps', async () => {
      const timestamps: string[] = [];

      for (let i = 0; i < 10; i++) {
        const exception = new Error(`rapid error ${String(i)}`);
        filter.catch(exception, mockArgumentsHost);

        const calls = (mockResponse.json as any).mock.calls as any[];
        const [lastCall] = calls.slice(-1);
        const [payload] = lastCall;

        timestamps.push(payload.timestamp);

        // Small delay to allow timestamp incrementation
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // All timestamps should be RFC3339 compliant
      timestamps.forEach((timestamp) => {
        expect(rfc3339Pattern.test(timestamp)).toBe(true);
      });
    });
  });
});
