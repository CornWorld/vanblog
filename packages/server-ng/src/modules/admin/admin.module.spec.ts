import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { AdminModule } from './admin.module';
import { CompatibilityController } from './compatibility.controller';

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

  describe('Controller availability', () => {
    it('should provide CompatibilityController', () => {
      const controller = module.get(CompatibilityController);
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(CompatibilityController);
    });
  });

  describe('Controller methods', () => {
    it('should make CompatibilityController methods accessible', () => {
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
  });

  describe('Dependency resolution', () => {
    it('should resolve all controllers without errors', () => {
      expect(() => {
        module.get(CompatibilityController);
      }).not.toThrow();
    });
  });
});
