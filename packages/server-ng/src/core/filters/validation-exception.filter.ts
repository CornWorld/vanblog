import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as {
      message?: string | string[];
      error?: string;
    };

    let validationErrors: string[] = [];
    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      validationErrors = exceptionResponse.message;
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: 'Validation Failed',
      message: validationErrors.length > 0 ? validationErrors : exceptionResponse.message,
    };

    this.logger.warn(
      `Validation Failed: ${request.method} ${request.url} - ${JSON.stringify(validationErrors)}`,
      'ValidationExceptionFilter',
    );

    response.status(status).json(errorResponse);
  }
}
