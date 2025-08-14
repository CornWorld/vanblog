import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { z } from 'zod';

import { ConfigRegistryService } from './config-registry.service';

describe('ConfigRegistryService', () => {
  let service: ConfigRegistryService;
  let mockConfigService: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockConfigService = {
      get: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigRegistryService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ConfigRegistryService>(ConfigRegistryService);

    // Mock logger to avoid console output during tests
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a configuration field', () => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        defaultValue: 3000,
      };

      expect(() => {
        service.register(field);
      }).not.toThrow();
    });

    it('should throw error when registering after initialization', () => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        defaultValue: 3000,
      };

      service.onModuleInit();

      expect(() => {
        service.register(field);
      }).toThrow('Cannot register fields after initialization');
    });
  });

  describe('registerBatch', () => {
    it('should register multiple fields', () => {
      const fields = [
        {
          key: 'app.port',
          module: 'app',
          schema: z.number(),
          defaultValue: 3000,
        },
        {
          key: 'app.host',
          module: 'app',
          schema: z.string(),
          defaultValue: 'localhost',
        },
      ];

      expect(() => {
        service.registerBatch(fields);
      }).not.toThrow();
    });
  });

  describe('get', () => {
    beforeEach(() => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        defaultValue: 3000,
      };
      service.register(field);
      // Don't initialize here - let each test control when to initialize
    });

    it('should return cached value', () => {
      mockConfigService.get.mockReturnValue(8080);
      service.onModuleInit(); // Initialize after setting mock

      const value1 = service.get('app.port');
      const value2 = service.get('app.port');

      expect(value1).toBe(8080);
      expect(value2).toBe(8080);
      expect(mockConfigService.get).toHaveBeenCalledTimes(1);
    });

    it('should return undefined for unregistered field', () => {
      service.onModuleInit();
      const value = service.get('unknown.field');
      expect(value).toBeUndefined();
    });

    it('should throw error when not initialized', () => {
      const uninitializedService = new ConfigRegistryService(
        mockConfigService as unknown as ConfigService,
      );
      expect(() => uninitializedService.get('app.port')).toThrow(
        'ConfigRegistryService not initialized. Call onModuleInit() first.',
      );
    });
  });

  describe('getOrDefault', () => {
    beforeEach(() => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        defaultValue: 3000,
      };
      service.register(field);
      // Don't initialize here - let each test control when to initialize
    });

    it('should return value when exists', () => {
      mockConfigService.get.mockReturnValue(8080);
      service.onModuleInit();

      const value = service.getOrDefault('app.port', 9000);
      expect(value).toBe(8080);
    });

    it('should return fallback when value is undefined', () => {
      mockConfigService.get.mockReturnValue(undefined);
      service.onModuleInit();

      const value = service.getOrDefault('app.port', 9000);
      expect(value).toBe(9000);
    });
  });

  describe('isModuleDisabled', () => {
    it('should return false for enabled module', () => {
      expect(service.isModuleDisabled('app')).toBe(false);
    });

    it('should return true for disabled module', () => {
      const field = {
        key: 'invalid.field',
        module: 'test',
        schema: z.string(),
        required: true,
        onError: 'disable' as const,
      };

      service.register(field);
      mockConfigService.get.mockReturnValue(undefined);

      service.onModuleInit();

      expect(service.isModuleDisabled('test')).toBe(true);
    });
  });

  describe('validation', () => {
    it('should handle validation errors with warn action', () => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        onError: 'warn' as const,
      };

      service.register(field);
      mockConfigService.get.mockReturnValue('invalid-number');

      expect(() => {
        service.onModuleInit();
      }).not.toThrow();
    });

    it('should handle validation errors with throw action', () => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        onError: 'throw' as const,
      };

      service.register(field);
      mockConfigService.get.mockReturnValue('invalid-number');

      expect(() => {
        service.onModuleInit();
      }).toThrow();
    });

    it('should handle custom validation', () => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        customValidator: (value: unknown) => {
          const num = value as number;
          return num < 1024 ? 'Port must be >= 1024' : null;
        },
        onError: 'warn' as const,
      };

      service.register(field);
      mockConfigService.get.mockReturnValue(80);

      expect(() => {
        service.onModuleInit();
      }).not.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should return registered keys', () => {
      const field = {
        key: 'app.port',
        module: 'app',
        schema: z.number(),
        defaultValue: 3000,
      };

      service.register(field);
      const keys = service.getRegisteredKeys();

      expect(keys).toContain('app.port');
    });

    it('should return disabled modules', () => {
      const field = {
        key: 'invalid.field',
        module: 'test',
        schema: z.string(),
        required: true,
        onError: 'disable' as const,
      };

      service.register(field);
      mockConfigService.get.mockReturnValue(undefined);
      service.onModuleInit();

      const disabledModules = service.getDisabledModules();
      expect(disabledModules).toContain('test');
    });
  });
});
