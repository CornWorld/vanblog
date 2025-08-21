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
});
