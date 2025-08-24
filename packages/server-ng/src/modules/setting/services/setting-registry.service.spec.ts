import { Test, type TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../database';

import { SettingRegistryService, type ConfigRegistration } from './setting-registry.service';

describe('SettingRegistryService', () => {
  let service: SettingRegistryService;
  let mockDatabase: any;
  let mockSelectChain: any;
  let mockInsertChain: any;
  let mockUpdateChain: any;
  let mockDeleteChain: any;

  beforeEach(async () => {
    mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    mockInsertChain = {
      into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn(),
    };

    mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };

    mockDeleteChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
    };

    mockDatabase = {
      select: vi.fn().mockReturnValue(mockSelectChain),
      insert: vi.fn().mockReturnValue(mockInsertChain),
      update: vi.fn().mockReturnValue(mockUpdateChain),
      delete: vi.fn().mockReturnValue(mockDeleteChain),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingRegistryService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<SettingRegistryService>(SettingRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerConfig', () => {
    it('should register a new config', () => {
      const registration: ConfigRegistration = {
        key: 'testKey',
        defaultValue: { test: 'value' },
        description: 'Test configuration',
      };

      service.registerConfig(registration);

      expect(service.getRegistration('testKey')).toEqual(registration);
    });
  });

  describe('getConfig', () => {
    it('should return config value when exists', async () => {
      const testKey = 'testKey';
      const testValue = { test: 'value' };

      mockSelectChain.limit.mockResolvedValue([{ value: JSON.stringify(testValue) }]);

      const result = await service.getConfig(testKey);

      expect(result).toEqual(testValue);
      expect(mockDatabase.select).toHaveBeenCalled();
      expect(mockSelectChain.from).toHaveBeenCalled();
      expect(mockSelectChain.where).toHaveBeenCalled();
      expect(mockSelectChain.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when config does not exist', async () => {
      const testKey = 'testKey';

      mockSelectChain.limit.mockResolvedValue([]);

      const result = await service.getConfig(testKey);

      expect(result).toBeNull();
    });

    it('should return null when config value is null', async () => {
      const testKey = 'testKey';

      mockSelectChain.limit.mockResolvedValue([{ value: null }]);

      const result = await service.getConfig(testKey);

      expect(result).toBeNull();
    });

    it('should persist and return default from registration when no value exists', async () => {
      const testKey = 'registered.with.default';
      const defaultValue = { foo: 'bar' };

      service.registerConfig({ key: testKey, defaultValue });

      // First select in getConfig -> empty
      mockSelectChain.limit.mockResolvedValueOnce([]);
      // Upsert path used by updateConfig
      mockDatabase.insert.mockReturnValue(mockInsertChain);
      mockInsertChain.onConflictDoUpdate.mockResolvedValue(undefined);

      const result = await service.getConfig<typeof defaultValue>(testKey);

      expect(result).toEqual(defaultValue);
      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalledWith({
        key: testKey,
        value: JSON.stringify(defaultValue),
      });
      expect(mockInsertChain.onConflictDoUpdate).toHaveBeenCalled();
    });

    it('should return null when stored JSON is invalid (parse failure)', async () => {
      const testKey = 'bad.json';
      mockSelectChain.limit.mockResolvedValue([{ value: '{invalid-json' }]);

      const result = await service.getConfig(testKey);

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should upsert configuration value idempotently (calls insert with onConflictDoUpdate)', async () => {
      const testKey = 'testKey';
      const testValue = { updated: 'value' };

      // Upsert path: insert(...).onConflictDoUpdate(...)
      mockInsertChain.onConflictDoUpdate.mockResolvedValue(undefined);

      const result = await service.updateConfig(testKey, testValue);

      expect(result).toEqual(testValue);
      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalledWith({
        key: testKey,
        value: JSON.stringify(testValue),
      });
      expect(mockInsertChain.onConflictDoUpdate).toHaveBeenCalled();
      // No need to select/update explicitly under upsert strategy
      expect(mockDatabase.select).not.toHaveBeenCalled();
      expect(mockDatabase.update).not.toHaveBeenCalled();
    });

    it('should upsert new config without pre-select', async () => {
      const testKey = 'newKey';
      const testValue = { new: 'value' };

      mockInsertChain.onConflictDoUpdate.mockResolvedValue(undefined);

      const result = await service.updateConfig(testKey, testValue);

      expect(result).toEqual(testValue);
      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockInsertChain.values).toHaveBeenCalledWith({
        key: testKey,
        value: JSON.stringify(testValue),
      });
      expect(mockInsertChain.onConflictDoUpdate).toHaveBeenCalled();
      expect(mockDatabase.select).not.toHaveBeenCalled();
      expect(mockDatabase.update).not.toHaveBeenCalled();
    });

    it('should throw when validator rejects the value', async () => {
      const testKey = 'with.validator';
      const value = { nope: true };
      service.registerConfig({ key: testKey, validator: () => false });

      await expect(service.updateConfig(testKey, value)).rejects.toThrow(
        `Invalid value for configuration key "${testKey}"`,
      );
      expect(mockDatabase.update).not.toHaveBeenCalled();
      expect(mockDatabase.insert).not.toHaveBeenCalled();
    });
  });

  describe('deleteConfig', () => {
    it('should delete config', async () => {
      const testKey = 'testKey';

      mockDeleteChain.where.mockResolvedValue(undefined);

      await service.deleteConfig(testKey);

      expect(mockDatabase.delete).toHaveBeenCalled();
      expect(mockDeleteChain.where).toHaveBeenCalled();
    });
  });

  describe('getRegisteredKeys', () => {
    it('should return all registered keys', () => {
      service.registerConfig({ key: 'key1' });
      service.registerConfig({ key: 'key2' });
      service.registerConfig({ key: 'key3' });

      const result = service.getRegisteredKeys();

      expect(result).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return empty array when no keys registered', () => {
      const result = service.getRegisteredKeys();

      expect(result).toEqual([]);
    });
  });

  describe('getRegistration', () => {
    it('should return registration when exists', () => {
      const testKey = 'testKey';
      const registration: ConfigRegistration = {
        key: testKey,
        defaultValue: { test: 'value' },
        description: 'Test description',
      };

      service.registerConfig(registration);
      const result = service.getRegistration(testKey);

      expect(result).toEqual(registration);
    });

    it('should return undefined when registration does not exist', () => {
      const testKey = 'nonExistentKey';

      const result = service.getRegistration(testKey);

      expect(result).toBeUndefined();
    });
  });
});
