import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { SettingRegistryService } from './services/setting-registry.service';
import { SettingRegistryController } from './setting-registry.controller';

describe('SettingRegistryController', () => {
  let controller: SettingRegistryController;

  const mockSettingRegistryService = {
    getRegisteredKeys: vi.fn(),
    getConfig: vi.fn(),
    getRegistration: vi.fn(),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingRegistryController],
      providers: [
        {
          provide: SettingRegistryService,
          useValue: mockSettingRegistryService,
        },
      ],
    }).compile();

    controller = module.get<SettingRegistryController>(SettingRegistryController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRegisteredKeys', () => {
    it('should return all registered configuration keys', () => {
      const mockKeys = ['site.title', 'site.description', 'theme.color'];
      mockSettingRegistryService.getRegisteredKeys.mockReturnValue(mockKeys);

      const result = controller.getRegisteredKeys();

      expect(result).toEqual(mockKeys);
      expect(mockSettingRegistryService.getRegisteredKeys).toHaveBeenCalled();
    });

    it('should return empty array when no keys are registered', () => {
      mockSettingRegistryService.getRegisteredKeys.mockReturnValue([]);

      const result = controller.getRegisteredKeys();

      expect(result).toEqual([]);
      expect(mockSettingRegistryService.getRegisteredKeys).toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return configuration value for existing key', async () => {
      const key = 'site.title';
      const value = 'My Blog';
      mockSettingRegistryService.getConfig.mockResolvedValue(value);

      const result = await controller.getConfig(key);

      expect(result).toEqual({ key, value });
      expect(mockSettingRegistryService.getConfig).toHaveBeenCalledWith(key);
    });

    it('should return null value for registered key with no value', async () => {
      const key = 'site.title';
      const registration = { key, defaultValue: 'Default Title' };
      mockSettingRegistryService.getConfig.mockResolvedValue(null);
      mockSettingRegistryService.getRegistration.mockReturnValue(registration);

      const result = await controller.getConfig(key);

      expect(result).toEqual({ key, value: null });
      expect(mockSettingRegistryService.getConfig).toHaveBeenCalledWith(key);
      expect(mockSettingRegistryService.getRegistration).toHaveBeenCalledWith(key);
    });

    it('should throw HttpException for unregistered key', async () => {
      const key = 'unknown.key';
      mockSettingRegistryService.getConfig.mockResolvedValue(null);
      mockSettingRegistryService.getRegistration.mockReturnValue(null);

      await expect(controller.getConfig(key)).rejects.toThrow(
        new HttpException(`Configuration key "${key}" is not registered`, HttpStatus.NOT_FOUND),
      );

      expect(mockSettingRegistryService.getConfig).toHaveBeenCalledWith(key);
      expect(mockSettingRegistryService.getRegistration).toHaveBeenCalledWith(key);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration value for registered key', async () => {
      const key = 'site.title';
      const value = 'Updated Title';
      const registration = { key, defaultValue: 'Default Title' };
      mockSettingRegistryService.getRegistration.mockReturnValue(registration);
      mockSettingRegistryService.updateConfig.mockResolvedValue(value);

      const result = await controller.updateConfig(key, value);

      expect(result).toEqual({ key, value });
      expect(mockSettingRegistryService.getRegistration).toHaveBeenCalledWith(key);
      expect(mockSettingRegistryService.updateConfig).toHaveBeenCalledWith(key, value);
    });

    it('should throw HttpException for unregistered key', async () => {
      const key = 'unknown.key';
      const value = 'Some Value';
      mockSettingRegistryService.getRegistration.mockReturnValue(null);

      await expect(controller.updateConfig(key, value)).rejects.toThrow(
        new HttpException(`Configuration key "${key}" is not registered`, HttpStatus.BAD_REQUEST),
      );

      expect(mockSettingRegistryService.getRegistration).toHaveBeenCalledWith(key);
      expect(mockSettingRegistryService.updateConfig).not.toHaveBeenCalled();
    });

    it('should throw HttpException when update fails', async () => {
      const key = 'site.title';
      const value = 'Invalid Value';
      const registration = { key, defaultValue: 'Default Title' };
      const error = new Error('Validation failed');
      mockSettingRegistryService.getRegistration.mockReturnValue(registration);
      mockSettingRegistryService.updateConfig.mockRejectedValue(error);

      await expect(controller.updateConfig(key, value)).rejects.toThrow(
        new HttpException('Validation failed', HttpStatus.BAD_REQUEST),
      );

      expect(mockSettingRegistryService.getRegistration).toHaveBeenCalledWith(key);
      expect(mockSettingRegistryService.updateConfig).toHaveBeenCalledWith(key, value);
    });

    it('should throw HttpException with generic message for unknown error', async () => {
      const key = 'site.title';
      const value = 'Some Value';
      const registration = { key, defaultValue: 'Default Title' };
      mockSettingRegistryService.getRegistration.mockReturnValue(registration);
      mockSettingRegistryService.updateConfig.mockRejectedValue('Unknown error');

      await expect(controller.updateConfig(key, value)).rejects.toThrow(
        new HttpException('Failed to update configuration', HttpStatus.BAD_REQUEST),
      );

      expect(mockSettingRegistryService.getRegistration).toHaveBeenCalledWith(key);
      expect(mockSettingRegistryService.updateConfig).toHaveBeenCalledWith(key, value);
    });
  });

  describe('deleteConfig', () => {
    it('should delete configuration successfully', async () => {
      const key = 'site.title';
      mockSettingRegistryService.deleteConfig.mockResolvedValue(undefined);

      const result = await controller.deleteConfig(key);

      expect(result).toEqual({
        message: `Configuration key "${key}" deleted successfully`,
      });
      expect(mockSettingRegistryService.deleteConfig).toHaveBeenCalledWith(key);
    });

    it('should handle deletion errors gracefully', async () => {
      const key = 'site.title';
      const error = new Error('Delete failed');
      mockSettingRegistryService.deleteConfig.mockRejectedValue(error);

      await expect(controller.deleteConfig(key)).rejects.toThrow(error);
      expect(mockSettingRegistryService.deleteConfig).toHaveBeenCalledWith(key);
    });
  });
});
