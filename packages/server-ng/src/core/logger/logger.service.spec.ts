/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, type TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';
import { ConfigService } from '../../config/config.service';

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

  it('should log info message', () => {
    const mockLogger = {
      info: vi.fn(),
    };
    (service as any).logger = mockLogger;

    service.info('Test message', 'TestContext');

    expect(mockLogger.info).toHaveBeenCalledWith('Test message', {
      context: 'TestContext',
    });
  });

  it('should log error message with trace', () => {
    const mockLogger = {
      error: vi.fn(),
    };
    (service as any).logger = mockLogger;

    service.error('Error message', 'Stack trace', 'ErrorContext');

    expect(mockLogger.error).toHaveBeenCalledWith('Error message', {
      context: 'ErrorContext',
      trace: 'Stack trace',
    });
  });

  it('should log warning message', () => {
    const mockLogger = {
      warn: vi.fn(),
    };
    (service as any).logger = mockLogger;

    service.warn('Warning message', 'WarnContext');

    expect(mockLogger.warn).toHaveBeenCalledWith('Warning message', {
      context: 'WarnContext',
    });
  });

  it('should log debug message', () => {
    const mockLogger = {
      debug: vi.fn(),
    };
    (service as any).logger = mockLogger;

    service.debug('Debug message', 'DebugContext');

    expect(mockLogger.debug).toHaveBeenCalledWith('Debug message', {
      context: 'DebugContext',
    });
  });

  it('should log verbose message', () => {
    const mockLogger = {
      verbose: vi.fn(),
    };
    (service as any).logger = mockLogger;

    service.verbose('Verbose message', 'VerboseContext');

    expect(mockLogger.verbose).toHaveBeenCalledWith('Verbose message', {
      context: 'VerboseContext',
    });
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
  });
});
