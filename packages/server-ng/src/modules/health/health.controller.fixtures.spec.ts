import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect } from 'vitest';

import { configTest } from '../../../test/vitest-fixtures.test';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('healthCheck', () => {
    configTest('should return health status', () => {
      const result = controller.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.environment).toBeDefined();
      expect(result.version).toBe('2.0.0');
    });

    configTest('should return valid ISO timestamp', () => {
      const result = controller.healthCheck();
      const timestamp = new Date(result.timestamp);

      expect(timestamp.toISOString()).toBe(result.timestamp);
    });
  });
});
