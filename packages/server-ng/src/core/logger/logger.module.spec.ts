import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { createConfigServiceMock } from '@test/mock';

import { LoggerModule } from './logger.module';
import { LoggerService } from './logger.service';

describe('LoggerModule', () => {
  let module: TestingModule;
  let loggerService: LoggerService;

  // Mock ConfigService using the proper mock helper
  const mockConfigService = createConfigServiceMock({
    app: {
      name: 'test-app',
      env: 'test',
    },
    log: {
      level: 'info',
      format: 'json',
      file: {
        enabled: false,
        path: './logs',
      },
    },
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LoggerModule],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide LoggerService', () => {
    expect(loggerService).toBeDefined();
    expect(loggerService).toBeInstanceOf(LoggerService);
  });

  it('should export LoggerService', () => {
    const exportedLoggerService = module.get<LoggerService>(LoggerService);
    expect(exportedLoggerService).toBeDefined();
    expect(exportedLoggerService).toBe(loggerService);
  });

  it('should use ConfigService', () => {
    const configService = module.get<ConfigService>(ConfigService);
    expect(configService).toBeDefined();
    expect(configService).toBe(mockConfigService);
  });

  it('should allow LoggerService to use ConfigService', () => {
    const configService = module.get<ConfigService>(ConfigService);
    expect(configService.app).toBeDefined();
    expect(configService.log).toBeDefined();
  });
});
