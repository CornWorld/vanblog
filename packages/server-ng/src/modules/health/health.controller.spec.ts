import { Test, type TestingModule } from '@nestjs/testing';
import { dayjs } from '@vanblog/shared';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status with timestamp', async () => {
      // Arrange
      const mockTimestamp = '2025-12-23T10:00:00+08:00';
      vi.spyOn(dayjs.prototype, 'format').mockReturnValue(mockTimestamp);

      // Act
      const result = controller.getHealth();
      const handler = await result(null as any);

      // Assert
      expect(handler).toBeDefined();
      expect(handler.status).toBe(200);
      expect(handler.body).toEqual({
        timestamp: mockTimestamp,
      });
    });

    it('should return status 200', async () => {
      // Act
      const result = controller.getHealth();
      const handler = await result(null as any);

      // Assert
      expect(handler.status).toBe(200);
    });

    it('should return a valid timestamp format', async () => {
      // Act
      const result = controller.getHealth();
      const handler = await result(null as any);

      // Assert
      expect(handler.body).toHaveProperty('timestamp');
      expect(typeof handler.body.timestamp).toBe('string');
      expect(handler.body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}/); // Basic ISO format check
    });

    it('should use dayjs to format timestamp', async () => {
      // Arrange
      const formatSpy = vi.spyOn(dayjs.prototype, 'format');

      // Act
      const result = controller.getHealth();
      await result(null as any);

      // Assert
      expect(formatSpy).toHaveBeenCalled();
    });

    it('should return current timestamp on each call', async () => {
      // Arrange
      const firstTimestamp = '2025-12-23T10:00:00+08:00';
      const secondTimestamp = '2025-12-23T10:00:01+08:00';
      const formatSpy = vi
        .spyOn(dayjs.prototype, 'format')
        .mockReturnValueOnce(firstTimestamp)
        .mockReturnValueOnce(secondTimestamp);

      // Act
      const result1 = controller.getHealth();
      const handler1 = await result1(null as any);

      const result2 = controller.getHealth();
      const handler2 = await result2(null as any);

      // Assert
      expect(handler1.body.timestamp).toBe(firstTimestamp);
      expect(handler2.body.timestamp).toBe(secondTimestamp);
      expect(formatSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle promise resolution correctly', async () => {
      // Act
      const result = controller.getHealth();
      const handler = await result(null as any);

      // Assert - verify the async behavior works correctly
      expect(handler).toBeDefined();
      expect(handler.status).toBe(200);
      expect(handler.body).toBeDefined();
    });

    it('should match ts-rest contract response shape', async () => {
      // Act
      const result = controller.getHealth();
      const handler = await result(null as any);

      // Assert - verify response matches HealthResponseSchema
      expect(handler.body).toHaveProperty('timestamp');
      expect(Object.keys(handler.body)).toHaveLength(1);
    });

    it('should not throw errors during execution', async () => {
      // Act & Assert
      await expect(
        (async () => {
          const result = controller.getHealth();
          await result(null as any);
        })(),
      ).resolves.not.toThrow();
    });
  });
});
