import { type ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { HttpExceptionFilter } from './http-exception.filter';

import type { LoggerService } from '../logger/logger.service';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockLogger: LoggerService;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockRequest: {
    url: string;
    method: string;
  };

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
    } as unknown as LoggerService;

    mockRequest = {
      url: '/api/test',
      method: 'GET',
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    mockArgumentsHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: vi.fn().mockReturnValue(mockResponse),
        getRequest: vi.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;

    filter = new HttpExceptionFilter(mockLogger);
  });

  it('should handle HttpException with string message', () => {
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'Test error',
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should handle HttpException with object response', () => {
    const errorResponse = { message: 'Validation failed', errors: ['field1 is required'] } as const;
    const exception = new HttpException(errorResponse, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'Validation failed',
      errors: ['field1 is required'],
    });
  });

  it('should handle various HTTP status codes', () => {
    const testCases = [
      { status: HttpStatus.UNAUTHORIZED, message: 'Unauthorized access' },
      { status: HttpStatus.FORBIDDEN, message: 'Access forbidden' },
      { status: HttpStatus.NOT_FOUND, message: 'Resource not found' },
      { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Server error' },
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

  it('should handle HttpException with empty message', () => {
    const exception = new HttpException('', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: '',
    });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should include exception stack in logger', () => {
    const exception = new HttpException('Test error', HttpStatus.INTERNAL_SERVER_ERROR);

    filter.catch(exception, mockArgumentsHost);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'HTTP Exception: GET /api/test',
      exception.stack,
      'HttpExceptionFilter',
    );
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

    methods.forEach((method) => {
      mockRequest.method = method;
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          method,
        }),
      );
    });
  });

  it('should handle complex object responses with nested data', () => {
    const complexResponse = {
      message: 'Complex error',
      details: {
        field: 'username',
        constraint: 'minLength',
        value: 'ab',
      },
      code: 'VALIDATION_ERROR',
    };
    const exception = new HttpException(complexResponse, HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/api/test',
      method: 'GET',
      message: 'Complex error',
      details: {
        field: 'username',
        constraint: 'minLength',
        value: 'ab',
      },
      code: 'VALIDATION_ERROR',
    });
  });

  it('should handle different URL paths', () => {
    const paths = ['/api/test', '/api/v2/articles', '/admin/settings', '/public/meta'];

    paths.forEach((path) => {
      mockRequest.url = path;
      const exception = new HttpException('Test error', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path,
        }),
      );
    });
  });
});
