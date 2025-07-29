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
    vi.spyOn(service as never, 'logger', 'get').mockReturnValue({
      info: vi.fn(),
    } as never);

    service.info('Test message', 'TestContext');

    expect((service as never).logger.info).toHaveBeenCalledWith('Test message', {
      context: 'TestContext',
    });
  });

  it('should log error message with trace', () => {
    vi.spyOn(service as never, 'logger', 'get').mockReturnValue({
      error: vi.fn(),
    } as never);

    service.error('Error message', 'Stack trace', 'ErrorContext');

    expect((service as never).logger.error).toHaveBeenCalledWith('Error message', {
      context: 'ErrorContext',
      trace: 'Stack trace',
    });
  });

  it('should log warning message', () => {
    vi.spyOn(service as never, 'logger', 'get').mockReturnValue({
      warn: vi.fn(),
    } as never);

    service.warn('Warning message', 'WarnContext');

    expect((service as never).logger.warn).toHaveBeenCalledWith('Warning message', {
      context: 'WarnContext',
    });
  });

  it('should log debug message', () => {
    vi.spyOn(service as never, 'logger', 'get').mockReturnValue({
      debug: vi.fn(),
    } as never);

    service.debug('Debug message', 'DebugContext');

    expect((service as never).logger.debug).toHaveBeenCalledWith('Debug message', {
      context: 'DebugContext',
    });
  });

  it('should log verbose message', () => {
    vi.spyOn(service as never, 'logger', 'get').mockReturnValue({
      verbose: vi.fn(),
    } as never);

    service.verbose('Verbose message', 'VerboseContext');

    expect((service as never).logger.verbose).toHaveBeenCalledWith('Verbose message', {
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
