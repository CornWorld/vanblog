import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { CsrfController } from './csrf.controller';

describe('CsrfController', () => {
  let controller: CsrfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CsrfController],
    }).compile();

    controller = module.get<CsrfController>(CsrfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCsrfToken', () => {
    it('should return an object with csrfToken property', () => {
      const result = controller.getCsrfToken();

      expect(result).toHaveProperty('csrfToken');
      expect(typeof result.csrfToken).toBe('string');
    });

    it('should return a 64-character hex string (32 bytes)', () => {
      const result = controller.getCsrfToken();

      expect(result.csrfToken).toHaveLength(64);
      expect(result.csrfToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should return a different token on each call', () => {
      const result1 = controller.getCsrfToken();
      const result2 = controller.getCsrfToken();

      expect(result1.csrfToken).not.toBe(result2.csrfToken);
    });
  });
});
