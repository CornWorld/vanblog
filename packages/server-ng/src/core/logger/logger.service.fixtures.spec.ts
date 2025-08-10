import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, vi } from 'vitest';

import { configTest } from '../../../test/vitest-fixtures.test';
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

  configTest('should be defined', () => {
    expect(service).toBeDefined();
  });

  configTest('should log info message', () => {
    const mockLogger = {
      info: vi.fn(),
    };
    (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

    service.info('Test message', 'TestContext');

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      context: 'TestContext',
    });
  });

  configTest('should log error message with trace', () => {
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

  configTest('should log warning message', () => {
    const mockLogger = {
      warn: vi.fn(),
    };
    (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

    service.warn('Warning message', 'WarnContext');

    expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', {
      context: 'WarnContext',
    });
  });

  configTest('should log debug message', () => {
    const mockLogger = {
      debug: vi.fn(),
    };
    (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

    service.debug('Debug message', 'DebugContext');

    expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', {
      context: 'DebugContext',
    });
  });

  configTest('should log verbose message', () => {
    const mockLogger = {
      verbose: vi.fn(),
    };
    (service as unknown as { logger: typeof mockLogger }).logger = mockLogger;

    service.verbose('Verbose message', 'VerboseContext');

    expect(mockLogger.verbose).toHaveBeenCalledWith('Verbose message', {
      context: 'VerboseContext',
    });
  });

  configTest('should use different configuration for development environment', () => {
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
  });
});
