import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { DATABASE_CONNECTION } from '../../../database';

import { HookService } from './hook.service';
import { PluginContextFactory } from './plugin-context.service';

describe('HookService', () => {
  let service: HookService;

  beforeEach(async () => {
    const mockDatabase = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const mockPluginContextFactory = {
      create: vi.fn().mockReturnValue({
        data: {},
        logger: { log: vi.fn(), error: vi.fn() },
        config: { get: vi.fn() },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HookService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDatabase,
        },
        {
          provide: PluginContextFactory,
          useValue: mockPluginContextFactory,
        },
      ],
    }).compile();

    service = module.get<HookService>(HookService);
    // Mock logger to avoid console output during tests
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    service.clearAllHooks();
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addAction', () => {
    it('should add an action with default priority', () => {
      const callback = vi.fn();
      const id = service.addAction('test|hook', callback);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(service.hasAction('test|hook')).toBe(true);
      expect(service.getActionCount('test|hook')).toBe(1);
    });

    it('should add an action with custom priority', () => {
      const callback = vi.fn();
      const id = service.addAction('test|hook', callback, 5);

      expect(id).toBeDefined();
      expect(service.hasAction('test|hook')).toBe(true);
    });

    it('should sort actions by priority', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      service.addAction('test|hook', callback1, 20);
      service.addAction('test|hook', callback2, 5);
      service.addAction('test|hook', callback3, 15);

      expect(service.getActionCount('test|hook')).toBe(3);
    });
  });

  describe('addFilter', () => {
    it('should add a filter with default priority', () => {
      const callback = vi.fn((value: string) => value);
      const id = service.addFilter('test|hook', callback);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(service.hasFilter('test|hook')).toBe(true);
      expect(service.getFilterCount('test|hook')).toBe(1);
    });

    it('should add a filter with custom priority', () => {
      const callback = vi.fn((value: string) => value);
      const id = service.addFilter('test|hook', callback, 5);

      expect(id).toBeDefined();
      expect(service.hasFilter('test|hook')).toBe(true);
    });
  });

  describe('removeAction', () => {
    it('should remove an action by id', () => {
      const callback = vi.fn();
      const id = service.addAction('test|hook', callback);

      expect(service.hasAction('test|hook')).toBe(true);
      expect(service.removeAction('test|hook', id)).toBe(true);
      expect(service.hasAction('test|hook')).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      expect(service.removeAction('non|existent', 'fake-id')).toBe(false);
    });

    it('should return false for non-existent id', () => {
      const callback = vi.fn();
      service.addAction('test|hook', callback);

      expect(service.removeAction('test|hook', 'fake-id')).toBe(false);
    });
  });

  describe('removeFilter', () => {
    it('should remove a filter by id', () => {
      const callback = vi.fn((value: string) => value);
      const id = service.addFilter('test|hook', callback);

      expect(service.hasFilter('test|hook')).toBe(true);
      expect(service.removeFilter('test|hook', id)).toBe(true);
      expect(service.hasFilter('test|hook')).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      expect(service.removeFilter('non|existent', 'fake-id')).toBe(false);
    });
  });

  describe('doAction', () => {
    it('should execute all actions in priority order', async () => {
      const results: number[] = [];
      const callback1 = vi.fn(() => {
        results.push(1);
      });
      const callback2 = vi.fn(() => {
        results.push(2);
      });
      const callback3 = vi.fn(() => {
        results.push(3);
      });

      service.addAction('test|hook', callback1, 20);
      service.addAction('test|hook', callback2, 5);
      service.addAction('test|hook', callback3, 15);
      await service.doAction('test|hook');

      expect(results).toEqual([2, 3, 1]); // Priority order: 5, 15, 20
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });

    it('should pass arguments to actions', async () => {
      const callback = vi.fn();
      service.addAction('test|hook', callback);

      await service.doAction('test|hook', 'arg1', 'arg2', 123);

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should handle async actions', async () => {
      const callback = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      service.addAction('test|hook', callback);

      await service.doAction('test|hook');

      expect(callback).toHaveBeenCalled();
    });

    it('should continue execution if one action throws', async () => {
      const callback1 = vi.fn(() => {
        throw new Error('Test error');
      });
      const callback2 = vi.fn();

      service.addAction('test|hook', callback1, 5);
      service.addAction('test|hook', callback2, 10);
      await service.doAction('test|hook');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should do nothing for non-existent hook', async () => {
      await expect(service.doAction('non|existent')).resolves.toBeUndefined();
    });
  });

  describe('applyFilters', () => {
    it('should apply all filters in priority order', async () => {
      const filter1 = vi.fn((value: string) => `${value}1`);
      const filter2 = vi.fn((value: string) => `${value}2`);
      const filter3 = vi.fn((value: string) => `${value}3`);

      service.addFilter('test|hook', filter1, 20);
      service.addFilter('test|hook', filter2, 5);
      service.addFilter('test|hook', filter3, 15);

      const result = await service.applyFilters('test|hook', 'start');

      expect(result).toBe('start231'); // Priority order: 5, 15, 20
      expect(filter1).toHaveBeenCalled();
      expect(filter2).toHaveBeenCalled();
      expect(filter3).toHaveBeenCalled();
    });

    it('should pass additional arguments to filters', async () => {
      const filter = vi.fn((value: string, ...args: unknown[]) => {
        const [arg1, arg2] = args as [string, number];
        return value + arg1 + String(arg2);
      });
      service.addFilter('test|hook', filter);

      const result = await service.applyFilters('test|hook', 'start', 'arg1', 123);

      expect(result).toBe('startarg1123');
      expect(filter).toHaveBeenCalledWith('start', 'arg1', 123);
    });

    it('should handle async filters', async () => {
      const filter = vi.fn(async (value: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `${value}async`;
      });
      service.addFilter('test|hook', filter);

      const result = await service.applyFilters('test|hook', 'start');

      expect(result).toBe('startasync');
    });

    it('should continue execution if one filter throws', async () => {
      const filter1 = vi.fn(() => {
        throw new Error('Test error');
      });
      const filter2 = vi.fn((value: string) => `${value}success`);

      service.addFilter('test|hook', filter1, 5);
      service.addFilter('test|hook', filter2, 10);

      const result = await service.applyFilters('test|hook', 'start');

      expect(result).toBe('startsuccess');
      expect(filter1).toHaveBeenCalled();
      expect(filter2).toHaveBeenCalled();
    });

    it('should return original value for non-existent hook', async () => {
      const result = await service.applyFilters('non|existent', 'original');
      expect(result).toBe('original');
    });
  });

  describe('utility methods', () => {
    it('should check if hook has actions', () => {
      expect(service.hasAction('test|hook')).toBe(false);
      service.addAction('test|hook', vi.fn());
      expect(service.hasAction('test|hook')).toBe(true);
    });

    it('should check if hook has filters', () => {
      expect(service.hasFilter('test|hook')).toBe(false);
      service.addFilter(
        'test|hook',
        vi.fn((v: unknown) => v),
      );
      expect(service.hasFilter('test|hook')).toBe(true);
    });

    it('should get action count', () => {
      expect(service.getActionCount('test|hook')).toBe(0);
      service.addAction('test|hook', vi.fn());
      service.addAction('test|hook', vi.fn());
      expect(service.getActionCount('test|hook')).toBe(2);
    });

    it('should get filter count', () => {
      expect(service.getFilterCount('test|hook')).toBe(0);
      service.addFilter(
        'test|hook',
        vi.fn((v: unknown) => v),
      );
      service.addFilter(
        'test|hook',
        vi.fn((v: unknown) => v),
      );
      expect(service.getFilterCount('test|hook')).toBe(2);
    });

    it('should get all action hooks', () => {
      service.addAction('hook1|event', vi.fn());
      service.addAction('hook2|event', vi.fn());
      const hooks = service.getAllActionHooks();
      expect(hooks).toContain('hook1|event');
      expect(hooks).toContain('hook2|event');
    });

    it('should get all filter hooks', () => {
      service.addFilter(
        'hook1|event',
        vi.fn((v: unknown) => v),
      );
      service.addFilter(
        'hook2|event',
        vi.fn((v: unknown) => v),
      );
      const hooks = service.getAllFilterHooks();
      expect(hooks).toContain('hook1|event');
      expect(hooks).toContain('hook2|event');
    });

    it('should clear all hooks', () => {
      service.addAction('hook1|event', vi.fn());
      service.addFilter(
        'hook2|event',
        vi.fn((v: unknown) => v),
      );

      expect(service.hasAction('hook1|event')).toBe(true);
      expect(service.hasFilter('hook2|event')).toBe(true);

      service.clearAllHooks();

      expect(service.hasAction('hook1|event')).toBe(false);
      expect(service.hasFilter('hook2|event')).toBe(false);
    });

    it('should clear specific hook', () => {
      service.addAction('hook1|event', vi.fn());
      service.addAction('hook2|event', vi.fn());
      service.addFilter(
        'hook1|event',
        vi.fn((v: unknown) => v),
      );

      service.clearHook('hook1|event');

      expect(service.hasAction('hook1|event')).toBe(false);
      expect(service.hasFilter('hook1|event')).toBe(false);
      expect(service.hasAction('hook2|event')).toBe(true);
    });
  });
  describe('name normalization compatibility', () => {
    it('should normalize snake_case and kebab-case to the same canonical hook', async () => {
      const action1 = vi.fn();
      const action2 = vi.fn();
      // legacy names should still work via normalization
      service.addAction('user|password_changed', action1);
      service.addAction('user|password-changed', action2);

      await service.doAction('user|passwordChanged', { id: 1 });

      expect(action1).toHaveBeenCalledTimes(1);
      expect(action2).toHaveBeenCalledTimes(1);
      // and canonical form also triggers them
      await service.doAction('user|afterPasswordChange', { id: 1 });
      expect(action1).toHaveBeenCalledTimes(2);
      expect(action2).toHaveBeenCalledTimes(2);
    });

    it('should map afterUpdate alias to updated and support mixed module casing', async () => {
      const action = vi.fn();
      // Register with legacy alias and uppercase module
      service.addAction('Article|afterUpdate', action);
      await service.doAction('article|afterUpdate', { id: 1 });

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should map before_update to beforeUpdate for filters', async () => {
      const filter = vi.fn((value: Record<string, unknown>) => ({ ...value, ok: true }));
      service.addFilter('article|before_update', filter);
      const input = { id: 1 } as Record<string, unknown>;
      const result = await service.applyFilters('article|beforeUpdate', input);

      expect(filter).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 1, ok: true });
    });
  });
});
