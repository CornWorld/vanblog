import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { PluginRegistryService } from './plugin-registry.service';

describe('PluginRegistryService', () => {
  let service: PluginRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginRegistryService],
    }).compile();

    service = module.get<PluginRegistryService>(PluginRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a plugin data provider', () => {
      const provider = vi.fn().mockResolvedValue({ test: 'data' });

      service.register('test-plugin', provider);
      expect(service.isRegistered('test-plugin')).toBe(true);
    });

    it('should throw error for invalid plugin name', () => {
      const provider = vi.fn();

      expect(() => {
        service.register('', provider);
      }).toThrow();
      expect(() => {
        service.register(null as any, provider);
      }).toThrow();
    });

    it('should throw error for invalid provider', () => {
      expect(() => {
        service.register('test', null as any);
      }).toThrow();
      expect(() => {
        service.register('test', 'not-a-function' as any);
      }).toThrow();
    });
  });

  describe('unregister', () => {
    it('should unregister existing plugin', () => {
      const provider = vi.fn();
      service.register('test-plugin', provider);

      const result = service.unregister('test-plugin');

      expect(result).toBe(true);
      expect(service.isRegistered('test-plugin')).toBe(false);
    });

    it('should return false for non-existing plugin', () => {
      const result = service.unregister('non-existing');
      expect(result).toBe(false);
    });
  });

  describe('getAllPublicData', () => {
    it('should return empty object when no plugins registered', async () => {
      const result = await service.getAllPublicData();
      expect(result).toEqual({});
    });

    it('should collect data from all registered plugins', async () => {
      const provider1 = vi.fn().mockResolvedValue({ rewards: ['reward1'] });
      const provider2 = vi.fn().mockResolvedValue({ settings: { theme: 'dark' } });

      service.register('rewards-plugin', provider1);
      service.register('settings-plugin', provider2);

      const result = await service.getAllPublicData();

      expect(result).toEqual({
        'rewards-plugin': { rewards: ['reward1'] },
        'settings-plugin': { settings: { theme: 'dark' } },
      });
      expect(provider1).toHaveBeenCalled();
      expect(provider2).toHaveBeenCalled();
    });

    it('should skip failed plugins and continue with others', async () => {
      const provider1 = vi.fn().mockRejectedValue(new Error('Provider failed'));
      const provider2 = vi.fn().mockResolvedValue({ data: 'success' });

      service.register('failing-plugin', provider1);
      service.register('working-plugin', provider2);

      const result = await service.getAllPublicData();

      expect(result).toEqual({
        'working-plugin': { data: 'success' },
      });
      expect(provider1).toHaveBeenCalled();
      expect(provider2).toHaveBeenCalled();
    });
  });

  describe('getPluginData', () => {
    it('should return plugin data for existing plugin', async () => {
      const provider = vi.fn().mockResolvedValue({ test: 'data' });
      service.register('test-plugin', provider);

      const result = await service.getPluginData('test-plugin');

      expect(result).toEqual({ test: 'data' });
      expect(provider).toHaveBeenCalled();
    });

    it('should return null for non-existing plugin', async () => {
      const result = await service.getPluginData('non-existing');
      expect(result).toBeNull();
    });

    it('should return null when provider fails', async () => {
      const provider = vi.fn().mockRejectedValue(new Error('Provider failed'));
      service.register('failing-plugin', provider);

      const result = await service.getPluginData('failing-plugin');

      expect(result).toBeNull();
      expect(provider).toHaveBeenCalled();
    });
  });
});
