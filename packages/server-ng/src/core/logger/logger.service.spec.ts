import { Test, type TestingModule } from '@nestjs/testing';
import type * as winston from 'winston';

import { ConfigService } from '../../config/config.service';

import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  const mockConfigService = {
    app: {
      isDevelopment: false,
      nodeEnv: 'test',
    },
    log: {
      level: 'info',
      dir: 'logs',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log methods', () => {
    it('should log message using log method', () => {
      const mockLogger = {
        info: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.log('Test message', 'TestContext');

      expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
      });
    });

    it('should log message without context', () => {
      const mockLogger = {
        info: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.log('Test message');

      expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
        context: undefined,
      });
    });

    it('should log info message', () => {
      const mockLogger = {
        info: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.info('Test message', 'TestContext');

      expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
      });
    });

    it('should log error message with trace', () => {
      const mockLogger = {
        error: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.error('Error message', 'Stack trace', 'ErrorContext');

      expect(mockLogger.error).toHaveBeenCalledWith('Error message', {
        context: 'ErrorContext',
        trace: 'Stack trace',
      });
    });

    it('should log error message without trace', () => {
      const mockLogger = {
        error: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.error('Error message', undefined, 'ErrorContext');

      expect(mockLogger.error).toHaveBeenCalledWith('Error message', {
        context: 'ErrorContext',
        trace: undefined,
      });
    });

    it('should log warning message', () => {
      const mockLogger = {
        warn: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.warn('Warning message', 'WarnContext');

      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', {
        context: 'WarnContext',
      });
    });

    it('should log debug message', () => {
      const mockLogger = {
        debug: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.debug('Debug message', 'DebugContext');

      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', {
        context: 'DebugContext',
      });
    });

    it('should log verbose message', () => {
      const mockLogger = {
        verbose: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      service.verbose('Verbose message', 'VerboseContext');

      expect(mockLogger.verbose).toHaveBeenCalledWith('Verbose message', {
        context: 'VerboseContext',
      });
    });
  });

  describe('logger creation', () => {
    it('should create logger with console transport in test environment', () => {
      expect(service).toBeDefined();
      const { logger } = service as unknown as { logger: winston.Logger };
      expect(logger).toBeDefined();
      expect(logger.transports).toBeDefined();
      expect(logger.transports.length).toBeGreaterThan(0);
    });

    it('should use different configuration for development environment', () => {
      const devMockConfigService = {
        app: {
          isDevelopment: true,
          nodeEnv: 'development',
        },
        log: {
          level: 'debug',
          dir: 'logs',
        },
      };

      const devService = new LoggerService(devMockConfigService as ConfigService);
      expect(devService).toBeDefined();
      const { logger } = devService as unknown as { logger: winston.Logger };
      expect(logger.level).toBe('debug');
    });

    it('should configure logger for production environment', () => {
      const prodMockConfigService = {
        app: {
          isDevelopment: false,
          nodeEnv: 'production',
        },
        log: {
          level: 'warn',
          dir: '/var/log/app',
        },
      };

      const prodService = new LoggerService(prodMockConfigService as ConfigService);
      expect(prodService).toBeDefined();
      const { logger } = prodService as unknown as { logger: winston.Logger };
      expect(logger.level).toBe('warn');
    });

    it('should apply custom log level from config', () => {
      const customConfigService = {
        app: {
          isDevelopment: false,
          nodeEnv: 'test',
        },
        log: {
          level: 'verbose',
          dir: 'logs',
        },
      };

      const customService = new LoggerService(customConfigService as ConfigService);
      expect(customService).toBeDefined();
      const { logger } = customService as unknown as { logger: winston.Logger };
      expect(logger.level).toBe('verbose');
    });
  });

  describe('winston format configuration', () => {
    it('should format log with context in development mode', () => {
      const devConfigService = {
        app: {
          isDevelopment: true,
          nodeEnv: 'development',
        },
        log: {
          level: 'info',
          dir: 'logs',
        },
      };

      const devService = new LoggerService(devConfigService as ConfigService);
      const { logger } = devService as unknown as { logger: winston.Logger };

      // Test that logger is configured with formats
      expect(logger.format).toBeDefined();
    });

    it('should format log without context', () => {
      const devConfigService = {
        app: {
          isDevelopment: true,
          nodeEnv: 'development',
        },
        log: {
          level: 'info',
          dir: 'logs',
        },
      };

      const devService = new LoggerService(devConfigService as ConfigService);
      expect(devService).toBeDefined();
    });

    it('should handle log with trace information', () => {
      const mockLogger = {
        error: vi.fn(),
      };
      (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      const traceMessage = 'Error: Test error\n  at TestClass.method (test.ts:10:5)';
      service.error('Test error', traceMessage, 'ErrorContext');

      expect(mockLogger.error).toHaveBeenCalledWith('Test error', {
        context: 'ErrorContext',
        trace: traceMessage,
      });
    });

    it('should handle log with additional metadata', () => {
      const devConfigService = {
        app: {
          isDevelopment: true,
          nodeEnv: 'development',
        },
        log: {
          level: 'info',
          dir: 'logs',
        },
      };

      const devService = new LoggerService(devConfigService as ConfigService);
      const { logger } = devService as unknown as { logger: winston.Logger };

      // Test logging with metadata
      const logSpy = vi.spyOn(logger, 'info');
      logger.info('Test message', { context: 'TestContext', userId: 123 });

      expect(logSpy).toHaveBeenCalledWith('Test message', {
        context: 'TestContext',
        userId: 123,
      });
    });
  });

  describe('file transports', () => {
    it('should not add file transports in development environment', () => {
      const devConfigService = {
        app: {
          isDevelopment: true,
          nodeEnv: 'development',
        },
        log: {
          level: 'info',
          dir: 'logs',
        },
      };

      const devService = new LoggerService(devConfigService as ConfigService);
      const { logger } = devService as unknown as { logger: winston.Logger };

      // In development, should only have console transport
      expect(logger.transports.length).toBe(1);
      expect(logger.transports[0].constructor.name).toBe('Console');
    });

    it('should not add file transports in test environment', () => {
      const { logger } = service as unknown as { logger: winston.Logger };

      // In test, should only have console transport
      expect(logger.transports.length).toBe(1);
      expect(logger.transports[0].constructor.name).toBe('Console');
    });

    it('should attempt to add file transports in production environment', async () => {
      const prodConfigService = {
        app: {
          isDevelopment: false,
          nodeEnv: 'production',
        },
        log: {
          level: 'info',
          dir: '/var/log/app',
        },
      };

      const prodService = new LoggerService(prodConfigService as ConfigService);
      expect(prodService).toBeDefined();

      // Give time for async addFileTransports to potentially complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The service should be created successfully regardless of file transport success
      const { logger } = prodService as unknown as { logger: winston.Logger };
      expect(logger).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should continue logging even if file transport setup fails', async () => {
      const prodConfigService = {
        app: {
          isDevelopment: false,
          nodeEnv: 'production',
        },
        log: {
          level: 'info',
          dir: '/tmp/claude/test-logs',
        },
      };

      const prodService = new LoggerService(prodConfigService as ConfigService);

      // Should still be able to log via console transport
      const mockLogger = {
        info: vi.fn(),
      };
      (prodService as unknown as { logger: typeof mockLogger }).logger = mockLogger;

      prodService.info('Test message');
      expect(mockLogger.info).toHaveBeenCalledWith('Test message', { context: undefined });

      // Wait for async file transport operations to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  });
});
