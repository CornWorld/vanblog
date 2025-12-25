import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationExceptionFilter } from './validation-exception.filter';

import type { LoggerService } from '../logger/logger.service';

describe('ValidationExceptionFilter', () => {
  let filter: ValidationExceptionFilter;
  let mockLogger: LoggerService;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let mockRequest: { url: string; method: string };

  beforeEach(() => {
    mockLogger = {
      warn: vi.fn(),
    } as unknown as LoggerService;

    mockRequest = { url: '/api/test', method: 'POST' };
    mockResponse = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

    mockArgumentsHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue(mockResponse),
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    filter = new ValidationExceptionFilter(mockLogger);
  });

  it('should format array messages and log warn', () => {
    const exception = new BadRequestException({ message: ['a', 'b'], error: 'Bad Request' });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
      message: ['a', 'b'],
    });
    expect((mockLogger as any).warn).toHaveBeenCalled();
  });

  it('should pass through string message', () => {
    const exception = new BadRequestException({ message: 'oops', error: 'Bad Request' });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
      message: 'oops',
    });
  });

  it('should handle missing message field gracefully', () => {
    const exception = new BadRequestException({ error: 'Bad Request' } as any);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const calls = (mockResponse.json as any).mock.calls as any[];
    const [lastCall] = calls.slice(-1);
    const [payload] = lastCall;
    expect(payload).toMatchObject({
      statusCode: 400,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
    });
    expect('message' in payload).toBe(true);
    expect(payload.message).toBeUndefined();
    expect((mockLogger as any).warn).toHaveBeenCalled();
  });

  it('should pass through non-array, non-string message objects', () => {
    const msg = { a: 1 } as any;
    const exception = new BadRequestException({ message: msg, error: 'Bad Request' } as any);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const calls = (mockResponse.json as any).mock.calls as any[];
    const [lastCall] = calls.slice(-1);
    const [payload] = lastCall;
    expect(payload).toMatchObject({
      statusCode: 400,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
    });
    expect(payload.message).toEqual(msg);
    expect((mockLogger as any).warn).toHaveBeenCalled();
  });

  it('should handle empty array validation errors', () => {
    const exception = new BadRequestException({ message: [], error: 'Bad Request' });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
      message: [],
    });
  });

  it('should handle multiple validation errors', () => {
    const validationErrors = [
      'email must be a valid email',
      'password must be longer than 8 characters',
      'username is required',
    ];
    const exception = new BadRequestException({ message: validationErrors, error: 'Bad Request' });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
      message: validationErrors,
    });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Validation Failed: POST /api/test - ${JSON.stringify(validationErrors)}`,
      'ValidationExceptionFilter',
    );
  });

  it('should handle validation on different URL paths', () => {
    const paths = ['/api/users', '/api/v2/articles', '/admin/settings'];

    paths.forEach((path) => {
      mockRequest.url = path;
      const exception = new BadRequestException({ message: ['error'], error: 'Bad Request' });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path,
        }),
      );
    });
  });

  it('should handle validation with different HTTP methods', () => {
    const methods = ['POST', 'PUT', 'PATCH'];

    methods.forEach((method) => {
      mockRequest.method = method;
      const exception = new BadRequestException({
        message: ['validation error'],
        error: 'Bad Request',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          method,
        }),
      );
    });
  });

  it('should log correct context in warning', () => {
    const errors = ['field1 is invalid', 'field2 is required'];
    const exception = new BadRequestException({ message: errors, error: 'Bad Request' });

    filter.catch(exception, mockArgumentsHost);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      `Validation Failed: POST /api/test - ${JSON.stringify(errors)}`,
      'ValidationExceptionFilter',
    );
  });

  it('should handle nested validation error objects', () => {
    const nestedErrors = [
      { field: 'email', message: 'Invalid email format' },
      { field: 'password', message: 'Too short' },
    ];
    const exception = new BadRequestException({
      message: nestedErrors as any,
      error: 'Bad Request',
    });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    const calls = (mockResponse.json as any).mock.calls as any[];
    const [lastCall] = calls.slice(-1);
    const [payload] = lastCall;
    expect(payload).toMatchObject({
      statusCode: 400,
      path: '/api/test',
      method: 'POST',
      error: 'Validation Failed',
      message: nestedErrors,
    });
  });

  it('should include timestamp in response', () => {
    const exception = new BadRequestException({ message: ['error'], error: 'Bad Request' });

    filter.catch(exception, mockArgumentsHost);

    const calls = (mockResponse.json as any).mock.calls as any[];
    const [lastCall] = calls.slice(-1);
    const [payload] = lastCall;
    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe('string');
  });
});
