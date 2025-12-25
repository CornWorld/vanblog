import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CompatibilityController } from './compatibility.controller';

describe('CompatibilityController', () => {
  let controller: CompatibilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompatibilityController],
    }).compile();

    controller = module.get<CompatibilityController>(CompatibilityController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('ISR endpoints', () => {
    describe('triggerISR', () => {
      it('should return success stub response', () => {
        const result = controller.triggerISR();

        expect(result).toEqual({
          success: true,
          message: 'ISR trigger stub called',
        });
      });
    });

    describe('getISRConfig', () => {
      it('should return default ISR config stub', () => {
        const result = controller.getISRConfig();

        expect(result).toEqual({
          skip: false,
          interval: 3600,
        });
      });

      it('should return consistent config on multiple calls', () => {
        const result1 = controller.getISRConfig();
        const result2 = controller.getISRConfig();

        expect(result1).toEqual(result2);
      });
    });

    describe('updateISRConfig', () => {
      it('should echo back the input config', () => {
        const input = { skip: true, interval: 7200 };
        const result = controller.updateISRConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle empty config object', () => {
        const input = {};
        const result = controller.updateISRConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle additional fields', () => {
        const input = {
          skip: false,
          interval: 1800,
          customField: 'value',
          nested: { field: 'test' },
        };
        const result = controller.updateISRConfig(input);

        expect(result).toEqual(input);
      });
    });
  });

  describe('Caddy endpoints', () => {
    describe('getCaddyLogs', () => {
      it('should return empty logs array stub', () => {
        const result = controller.getCaddyLogs();

        expect(result).toEqual({
          logs: [],
        });
      });
    });

    describe('clearCaddyLogs', () => {
      it('should return success stub response', () => {
        const result = controller.clearCaddyLogs();

        expect(result).toEqual({
          success: true,
        });
      });
    });

    describe('getCaddyConfig', () => {
      it('should return empty config string stub', () => {
        const result = controller.getCaddyConfig();

        expect(result).toEqual({
          config: '',
        });
      });
    });
  });

  describe('Settings endpoints', () => {
    describe('getHttpsConfig', () => {
      it('should return default HTTPS config stub', () => {
        const result = controller.getHttpsConfig();

        expect(result).toEqual({
          enabled: false,
          email: '',
          domain: '',
        });
      });

      it('should return consistent config on multiple calls', () => {
        const result1 = controller.getHttpsConfig();
        const result2 = controller.getHttpsConfig();

        expect(result1).toEqual(result2);
      });
    });

    describe('updateHttpsConfig', () => {
      it('should echo back the input config', () => {
        const input = {
          enabled: true,
          email: 'admin@example.com',
          domain: 'example.com',
        };
        const result = controller.updateHttpsConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle partial config updates', () => {
        const input = { enabled: true };
        const result = controller.updateHttpsConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle empty config object', () => {
        const input = {};
        const result = controller.updateHttpsConfig(input);

        expect(result).toEqual(input);
      });
    });

    describe('getLoginConfig', () => {
      it('should return default login config stub', () => {
        const result = controller.getLoginConfig();

        expect(result).toEqual({
          allowRegister: false,
          allowSocialLogin: false,
        });
      });

      it('should return consistent config on multiple calls', () => {
        const result1 = controller.getLoginConfig();
        const result2 = controller.getLoginConfig();

        expect(result1).toEqual(result2);
      });
    });

    describe('updateLoginConfig', () => {
      it('should echo back the input config', () => {
        const input = {
          allowRegister: true,
          allowSocialLogin: true,
        };
        const result = controller.updateLoginConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle partial config updates', () => {
        const input = { allowRegister: false };
        const result = controller.updateLoginConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle additional fields', () => {
        const input = {
          allowRegister: true,
          allowSocialLogin: false,
          customSetting: 'test',
        };
        const result = controller.updateLoginConfig(input);

        expect(result).toEqual(input);
      });
    });

    describe('getWalineConfig', () => {
      it('should return default Waline config stub', () => {
        const result = controller.getWalineConfig();

        expect(result).toEqual({
          serverURL: '',
          pageSize: 10,
        });
      });

      it('should return consistent config on multiple calls', () => {
        const result1 = controller.getWalineConfig();
        const result2 = controller.getWalineConfig();

        expect(result1).toEqual(result2);
      });
    });

    describe('updateWalineConfig', () => {
      it('should echo back the input config', () => {
        const input = {
          serverURL: 'https://waline.example.com',
          pageSize: 20,
        };
        const result = controller.updateWalineConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle partial config updates', () => {
        const input = { serverURL: 'https://waline.example.com' };
        const result = controller.updateWalineConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle empty config object', () => {
        const input = {};
        const result = controller.updateWalineConfig(input);

        expect(result).toEqual(input);
      });

      it('should handle additional fields', () => {
        const input = {
          serverURL: 'https://waline.example.com',
          pageSize: 15,
          locale: 'zh-CN',
        };
        const result = controller.updateWalineConfig(input);

        expect(result).toEqual(input);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple endpoint calls independently', () => {
      const isrResult = controller.triggerISR();
      const caddyResult = controller.clearCaddyLogs();
      const httpsResult = controller.getHttpsConfig();

      expect(isrResult.success).toBe(true);
      expect(caddyResult.success).toBe(true);
      expect(httpsResult.enabled).toBe(false);
    });

    it('should not persist state between update calls', () => {
      const firstUpdate = controller.updateISRConfig({ skip: true });
      const secondUpdate = controller.updateISRConfig({ skip: false });

      expect(firstUpdate).not.toEqual(secondUpdate);
      expect(firstUpdate.skip).toBe(true);
      expect(secondUpdate.skip).toBe(false);
    });

    it('should handle all stub endpoints without errors', () => {
      expect(() => {
        controller.triggerISR();
        controller.getISRConfig();
        controller.updateISRConfig({});
        controller.getCaddyLogs();
        controller.clearCaddyLogs();
        controller.getCaddyConfig();
        controller.getHttpsConfig();
        controller.updateHttpsConfig({});
        controller.getLoginConfig();
        controller.updateLoginConfig({});
        controller.getWalineConfig();
        controller.updateWalineConfig({});
      }).not.toThrow();
    });
  });

  describe('Type safety', () => {
    it('should accept Record<string, unknown> for updateISRConfig', () => {
      const input: Record<string, unknown> = {
        skip: true,
        interval: 3600,
        any: 'value',
      };
      const result = controller.updateISRConfig(input);

      expect(result).toEqual(input);
    });

    it('should accept Record<string, unknown> for updateHttpsConfig', () => {
      const input: Record<string, unknown> = {
        enabled: true,
        email: 'test@example.com',
      };
      const result = controller.updateHttpsConfig(input);

      expect(result).toEqual(input);
    });

    it('should accept Record<string, unknown> for updateLoginConfig', () => {
      const input: Record<string, unknown> = {
        allowRegister: true,
      };
      const result = controller.updateLoginConfig(input);

      expect(result).toEqual(input);
    });

    it('should accept Record<string, unknown> for updateWalineConfig', () => {
      const input: Record<string, unknown> = {
        serverURL: 'https://example.com',
      };
      const result = controller.updateWalineConfig(input);

      expect(result).toEqual(input);
    });
  });
});
