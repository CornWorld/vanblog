import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { IsrController } from './isr.controller';

describe('IsrController', () => {
  let controller: IsrController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IsrController],
    }).compile();

    controller = module.get<IsrController>(IsrController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerISRStd', () => {
    it('should return { success: true }', () => {
      const result = controller.triggerISRStd();

      expect(result).toEqual({ success: true });
    });
  });
});
