import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { AdminMetaModule } from './meta.module';
import { AdminMetaController } from './meta.controller';
import { MetaService } from './meta.service';

describe('AdminMetaModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AdminMetaModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('Module composition', () => {
    it('should provide AdminMetaController', () => {
      const controller = module.get(AdminMetaController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(AdminMetaController);
    });

    it('should provide MetaService', () => {
      const service = module.get(MetaService);
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(MetaService);
    });
  });

  describe('Service injection', () => {
    it('should inject MetaService into AdminMetaController', () => {
      const controller = module.get(AdminMetaController);
      const service = module.get(MetaService);

      expect(controller).toBeDefined();
      expect(service).toBeDefined();

      // Test that controller can use service
      const result = controller.getVersionInfo();
      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(result.data).toBeDefined();
    });
  });

  describe('Module integration', () => {
    it('should compile successfully', async () => {
      await expect(
        Test.createTestingModule({
          imports: [AdminMetaModule],
        }).compile(),
      ).resolves.toBeDefined();
    });

    it('should allow standalone import', async () => {
      const standaloneModule = await Test.createTestingModule({
        imports: [AdminMetaModule],
      }).compile();

      const controller = standaloneModule.get(AdminMetaController);
      const service = standaloneModule.get(MetaService);

      expect(controller).toBeDefined();
      expect(service).toBeDefined();
    });
  });

  describe('Controller functionality', () => {
    it('should provide working getVersionInfo endpoint', () => {
      const controller = module.get(AdminMetaController);
      const result = controller.getVersionInfo();

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('latestVersion');
      expect(result.data).toHaveProperty('hasUpdate');
    });
  });

  describe('Dependency resolution', () => {
    it('should resolve all providers without errors', () => {
      expect(() => {
        module.get(AdminMetaController);
        module.get(MetaService);
      }).not.toThrow();
    });

    it('should maintain service singleton across requests', () => {
      const service1 = module.get(MetaService);
      const service2 = module.get(MetaService);

      expect(service1).toBe(service2);
    });

    it('should maintain controller singleton', () => {
      const controller1 = module.get(AdminMetaController);
      const controller2 = module.get(AdminMetaController);

      expect(controller1).toBe(controller2);
    });
  });
});
