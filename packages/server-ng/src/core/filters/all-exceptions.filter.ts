import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, HttpException } from '@nestjs/common';
import dayjs from 'dayjs';

import { LoggerService } from '../logger/logger.service';

import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      error =
        typeof exceptionResponse === 'string'
          ? { message: exceptionResponse }
          : (exceptionResponse as Record<string, unknown>);
    } else if (exception instanceof Error) {
      error = {
        message: exception.message,
        name: exception.name,
      };

      if (process.env.NODE_ENV === 'development') {
        error.stack = exception.stack;
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: dayjs().toISOString(),
      path: request.url,
      method: request.method,
      ...error,
    };

    this.logger.error(
      `Unhandled Exception: ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
      'AllExceptionsFilter',
    );

    response.status(status).json(errorResponse);
  }
}
