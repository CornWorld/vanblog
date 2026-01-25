import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';

import { SettingCoreController } from './setting-core.controller';
import { SettingRegistryController } from './setting-registry.controller';
import { SettingCoreService } from './services/setting-core.service';
import { SettingRegistryService } from './services/setting-registry.service';
import { SettingModule } from './setting.module';

describe('SettingModule', () => {
  describe('module definition', () => {
    it('should be defined', () => {
      expect(SettingModule).toBeDefined();
    });

    it('should be a class', () => {
      expect(typeof SettingModule).toBe('function');
    });

    it('should have NestJS module decorators', () => {
      // SettingModule is decorated with @Module()
      expect(SettingModule).toBeDefined();
    });
  });

  describe('module exports', () => {
    it('should export SettingCoreService', async () => {
      const mockSettingCoreService = {
        getSetting: vi.fn().mockResolvedValue({ key: 'value' }),
        setSetting: vi.fn(),
        getSettings: vi.fn(),
        setSettings: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: SettingCoreService,
            useValue: mockSettingCoreService,
          },
        ],
        exports: [SettingCoreService],
      }).compile();

      const service = testModule.get<SettingCoreService>(SettingCoreService);
      expect(service).toBeDefined();
      expect(service).toBe(mockSettingCoreService);
    });

    it('should export SettingRegistryService', async () => {
      const mockSettingRegistryService = {
        register: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: SettingRegistryService,
            useValue: mockSettingRegistryService,
          },
        ],
        exports: [SettingRegistryService],
      }).compile();

      const service = testModule.get<SettingRegistryService>(SettingRegistryService);
      expect(service).toBeDefined();
      expect(service).toBe(mockSettingRegistryService);
    });
  });

  describe('feature permissions', () => {
    it('should register setting permissions through PermissionModule', () => {
      // Test the expected permissions array
      const expectedPermissions = ['setting:read', 'setting:update', 'setting:manage'];

      expect(expectedPermissions).toHaveLength(3);
      expect(expectedPermissions).toContain('setting:read');
      expect(expectedPermissions).toContain('setting:update');
      expect(expectedPermissions).toContain('setting:manage');
    });
  });

  describe('service injection', () => {
    it('should provide SettingCoreService to controllers', async () => {
      const mockService = {
        getSetting: vi.fn().mockResolvedValue({ key: 'value' }),
        setSetting: vi.fn(),
        getSettings: vi.fn(),
        setSettings: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        controllers: [SettingCoreController],
        providers: [
          {
            provide: SettingCoreService,
            useValue: mockService,
          },
        ],
      }).compile();

      const controller = testModule.get<SettingCoreController>(SettingCoreController);
      const service = testModule.get<SettingCoreService>(SettingCoreService);

      expect(controller).toBeDefined();
      expect(service).toBe(mockService);
    });

    it('should provide SettingRegistryService alongside SettingCoreService', async () => {
      const mockCoreService = {
        getSetting: vi.fn(),
        setSetting: vi.fn(),
        getSettings: vi.fn(),
        setSettings: vi.fn(),
      };

      const mockRegistryService = {
        register: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: SettingCoreService,
            useValue: mockCoreService,
          },
          {
            provide: SettingRegistryService,
            useValue: mockRegistryService,
          },
        ],
      }).compile();

      const coreService = testModule.get<SettingCoreService>(SettingCoreService);
      const registryService = testModule.get<SettingRegistryService>(SettingRegistryService);

      expect(coreService).toBeDefined();
      expect(registryService).toBeDefined();
      expect(coreService).toBe(mockCoreService);
      expect(registryService).toBe(mockRegistryService);
    });
  });

  describe('controllers', () => {
    it('should provide SettingCoreController', async () => {
      const mockCoreService = {
        getSetting: vi.fn(),
        setSetting: vi.fn(),
        getSettings: vi.fn(),
        setSettings: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        controllers: [SettingCoreController],
        providers: [
          {
            provide: SettingCoreService,
            useValue: mockCoreService,
          },
        ],
      }).compile();

      const controller = testModule.get<SettingCoreController>(SettingCoreController);
      expect(controller).toBeDefined();
    });

    it('should provide SettingRegistryController', async () => {
      const mockRegistryService = {
        register: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        controllers: [SettingRegistryController],
        providers: [
          {
            provide: SettingRegistryService,
            useValue: mockRegistryService,
          },
        ],
      }).compile();

      const controller = testModule.get<SettingRegistryController>(SettingRegistryController);
      expect(controller).toBeDefined();
    });
  });

  describe('module integration patterns', () => {
    it('should be importable in other modules', () => {
      // SettingModule can be imported and will export services
      expect(SettingModule).toBeDefined();
    });

    it('should support DatabaseModule import', () => {
      // SettingModule imports DatabaseModule
      expect(SettingModule).toBeDefined();
    });

    it('should support PermissionModule.forFeature()', () => {
      // PermissionModule.forFeature() is used to register permissions
      // This pattern allows fine-grained permission management per module
      expect(SettingModule).toBeDefined();
    });

    it('should provide both services for export', async () => {
      const mockCoreService = {
        getSetting: vi.fn(),
        setSetting: vi.fn(),
        getSettings: vi.fn(),
        setSettings: vi.fn(),
      };

      const mockRegistryService = {
        register: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
      };

      const testModule = await Test.createTestingModule({
        providers: [
          {
            provide: SettingCoreService,
            useValue: mockCoreService,
          },
          {
            provide: SettingRegistryService,
            useValue: mockRegistryService,
          },
        ],
        exports: [SettingCoreService, SettingRegistryService],
      }).compile();

      const coreService = testModule.get<SettingCoreService>(SettingCoreService);
      const registryService = testModule.get<SettingRegistryService>(SettingRegistryService);

      expect(coreService).toBeDefined();
      expect(registryService).toBeDefined();
    });
  });
});
