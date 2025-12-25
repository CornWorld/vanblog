import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { AdminModule } from './admin.module';
import { CompatibilityController } from './compatibility.controller';
import { AdminMetaModule } from './meta/meta.module';

describe('AdminModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AdminModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('Module composition', () => {
    it('should import AdminMetaModule', () => {
      const metaModule = module.get(AdminMetaModule);
      expect(metaModule).toBeDefined();
    });

    it('should provide CompatibilityController', () => {
      const controller = module.get(CompatibilityController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(CompatibilityController);
    });
  });

  describe('Controller availability', () => {
    it('should make CompatibilityController accessible', () => {
      const controller = module.get(CompatibilityController);
      expect(controller.triggerISR).toBeDefined();
      expect(controller.getISRConfig).toBeDefined();
      expect(controller.getCaddyLogs).toBeDefined();
      expect(controller.getHttpsConfig).toBeDefined();
    });
  });

  describe('Module integration', () => {
    it('should compile successfully', async () => {
      await expect(
        Test.createTestingModule({
          imports: [AdminModule],
        }).compile(),
      ).resolves.toBeDefined();
    });

    it('should import AdminMetaModule successfully', () => {
      const metaModule = module.get(AdminMetaModule);
      expect(metaModule).toBeDefined();
    });
  });

  describe('Dependency resolution', () => {
    it('should resolve all controllers without errors', () => {
      expect(() => {
        module.get(CompatibilityController);
      }).not.toThrow();
    });

    it('should resolve nested module without errors', () => {
      expect(() => {
        module.get(AdminMetaModule);
      }).not.toThrow();
    });
  });
});
