import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

import { ConfigService } from '../../config/config.service';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    this.logger = this.createLogger();
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  info(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, { context, trace });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }

  private createLogger(): winston.Logger {
    const { isDevelopment } = this.configService.app;
    const isTest = this.configService.app.nodeEnv === 'test';
    const logLevel = this.configService.log.level;
    const logDir = this.configService.log.dir;

    const formats = [
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json(),
    ];

    if (isDevelopment || isTest) {
      formats.push(
        winston.format.colorize(),
        winston.format.printf((info: winston.Logform.TransformableInfo) => {
          // Extract known fields from info object
          const { level } = info;
          const { message } = info;
          const { timestamp } = info;
          const context = info.context as string | undefined;
          const trace = info.trace as string | undefined;

          // Build meta object by filtering out known fields
          const meta = Object.entries(info)
            .filter(([key]) => !['level', 'message', 'timestamp', 'context', 'trace'].includes(key))
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

          const contextStr = context ? `[${context}] ` : '';
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          const traceStr = trace ? `\n${trace}` : '';
          return `${String(timestamp)} ${level}: ${contextStr}${String(message)}${metaStr}${traceStr}`;
        }),
      );
    }

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(...formats),
      }),
    ];

    if (!isDevelopment && !isTest) {
      // Dynamically import DailyRotateFile to avoid issues in test environment
      void this.addFileTransports(transports, logDir);
    }

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(...formats),
      transports,
    });
  }

  private async addFileTransports(transports: winston.transport[], logDir: string): Promise<void> {
    try {
      // Use dynamic import for winston-daily-rotate-file
      const { default: DailyRotateFile } = await import('winston-daily-rotate-file');

      transports.push(
        new DailyRotateFile({
          dirname: logDir,
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
        new DailyRotateFile({
          dirname: logDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
          format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
        }),
      );
    } catch (error) {
      // Log error using winston logger during startup
      this.logger.warn('Failed to load winston-daily-rotate-file:', error);
    }
  }
}
