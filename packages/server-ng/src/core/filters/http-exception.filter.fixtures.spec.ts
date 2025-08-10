import { type ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { beforeEach, describe, expect, vi } from 'vitest';

import { configTest } from '../../../test/vitest-fixtures.test';

import { HttpExceptionFilter } from './http-exception.filter';

import type { LoggerService } from '../logger/logger.service';

describe('HttpExceptionFilter with Vitest Fixtures', () => {
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

  configTest('should handle HttpException with string message', () => {
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

  configTest('should handle HttpException with object response', () => {
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
});
