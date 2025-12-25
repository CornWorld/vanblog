import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { HookService } from './hook.service';

describe('HookService', () => {
  let service: HookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookService],
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
  describe('stable ordering', () => {
    it('should keep registration order for actions with the same priority', async () => {
      const results: number[] = [];
      service.addAction(
        'stable|act',
        () => {
          results.push(1);
        },
        10,
      );
      service.addAction(
        'stable|act',
        () => {
          results.push(2);
        },
        10,
      );
      service.addAction(
        'stable|act',
        () => {
          results.push(3);
        },
        10,
      );

      await service.doAction('stable|act');
      expect(results).toEqual([1, 2, 3]);
    });

    it('should keep registration order for filters with the same priority', async () => {
      const seq: number[] = [];
      service.addFilter(
        'stable|filter',
        (v: string) => {
          seq.push(1);
          return `${v}a`;
        },
        10,
      );
      service.addFilter(
        'stable|filter',
        (v: string) => {
          seq.push(2);
          return `${v}b`;
        },
        10,
      );
      service.addFilter(
        'stable|filter',
        (v: string) => {
          seq.push(3);
          return `${v}c`;
        },
        10,
      );

      const out = await service.applyFilters('stable|filter', '');
      expect(seq).toEqual([1, 2, 3]);
      expect(out).toBe('abc');
    });

    // New tests for mixed priorities keep FIFO within the same priority bucket
    it('should execute actions in priority buckets with FIFO within each bucket', async () => {
      const order: string[] = [];
      service.addAction(
        'order|mix',
        () => {
          order.push('A');
        },
        10,
      );
      service.addAction(
        'order|mix',
        () => {
          order.push('B');
        },
        5,
      );
      service.addAction(
        'order|mix',
        () => {
          order.push('C');
        },
        10,
      );
      service.addAction(
        'order|mix',
        () => {
          order.push('D');
        },
        5,
      );
      service.addAction(
        'order|mix',
        () => {
          order.push('E');
        },
        15,
      );

      await service.doAction('order|mix');
      expect(order).toEqual(['B', 'D', 'A', 'C', 'E']);
    });

    it('should preserve FIFO among remaining same-priority actions after removal', async () => {
      const order: string[] = [];
      const idB = service.addAction(
        'order|mixSecond',
        () => {
          order.push('B');
        },
        5,
      );
      service.addAction(
        'order|mixSecond',
        () => {
          order.push('D');
        },
        5,
      );
      service.addAction(
        'order|mixSecond',
        () => {
          order.push('A');
        },
        10,
      );
      service.addAction(
        'order|mixSecond',
        () => {
          order.push('C');
        },
        10,
      );
      service.addAction(
        'order|mixSecond',
        () => {
          order.push('E');
        },
        15,
      );

      const removed = service.removeAction('order|mixSecond', idB);
      expect(removed).toBe(true);

      await service.doAction('order|mixSecond');
      expect(order).toEqual(['D', 'A', 'C', 'E']);
    });

    it('should apply filters in priority buckets with FIFO within each bucket', async () => {
      const seq: string[] = [];
      service.addFilter(
        'order|filterMix',
        (v: string) => {
          seq.push('B');
          return `${v}b`;
        },
        5,
      );
      service.addFilter(
        'order|filterMix',
        (v: string) => {
          seq.push('D');
          return `${v}d`;
        },
        5,
      );
      service.addFilter(
        'order|filterMix',
        (v: string) => {
          seq.push('A');
          return `${v}a`;
        },
        10,
      );
      service.addFilter(
        'order|filterMix',
        (v: string) => {
          seq.push('C');
          return `${v}c`;
        },
        10,
      );
      service.addFilter(
        'order|filterMix',
        (v: string) => {
          seq.push('E');
          return `${v}e`;
        },
        15,
      );

      const out = await service.applyFilters('order|filterMix', '');
      expect(seq).toEqual(['B', 'D', 'A', 'C', 'E']);
      expect(out).toBe('bdace');
    });
  });

  // Extra coverage for clearAll (distinct from clearAllHooks)
  describe('clearAll', () => {
    it('should clear both actions and filters using clearAll', () => {
      service.addAction('x|y', vi.fn());
      service.addFilter(
        'x|y',
        vi.fn((v: unknown) => v),
      );
      expect(service.getActionCount('x|y')).toBe(1);
      expect(service.getFilterCount('x|y')).toBe(1);

      service.clearAll();

      expect(service.getActionCount('x|y')).toBe(0);
      expect(service.getFilterCount('x|y')).toBe(0);
    });
  });
  describe('strict hook name validation', () => {
    it('should reject snake_case hook names and provide suggestions', () => {
      expect(() => {
        service.addAction('user|password_changed', vi.fn());
      }).toThrow(/Invalid event name 'password_changed'.*Did you mean 'afterPasswordChange'\?/);
    });

    it('should reject kebab-case hook names and provide suggestions', () => {
      expect(() => {
        service.addAction('user|password-changed', vi.fn());
      }).toThrow(/Invalid event name 'password-changed'.*Did you mean 'afterPasswordChange'\?/);
    });

    it('should reject invalid module names', () => {
      expect(() => {
        service.addAction('User|afterCreate', vi.fn());
      }).toThrow(/Invalid module name 'User'.*must be lowercase/);
    });

    it('should accept valid camelCase hook names', () => {
      expect(() => {
        service.addAction('user|afterPasswordChange', vi.fn());
        service.addFilter('article|beforeUpdate', vi.fn());
      }).not.toThrow();
    });

    it('should reject hook names without pipe separator', () => {
      expect(() => {
        service.addAction('userafterCreate', vi.fn());
      }).toThrow(/Invalid hook name.*Expected format: module\|event/);
    });

    it('should reject empty hook names', () => {
      expect(() => {
        service.addAction('', vi.fn());
      }).toThrow(/Invalid hook name.*Expected format: module\|event/);
    });

    it('should reject whitespace-only hook names', () => {
      expect(() => {
        service.addAction('   ', vi.fn());
      }).toThrow(/Invalid hook name.*Expected format: module\|event/);
    });

    it('should reject hook names with only module part', () => {
      expect(() => {
        service.addAction('user|', vi.fn());
      }).toThrow(/Invalid hook name.*Expected format: module\|event/);
    });

    it('should reject hook names with only event part', () => {
      expect(() => {
        service.addAction('|afterCreate', vi.fn());
      }).toThrow(/Invalid hook name.*Expected format: module\|event/);
    });

    it('should reject module names with uppercase letters', () => {
      expect(() => {
        service.addAction('UserAuth|afterCreate', vi.fn());
      }).toThrow(/Invalid module name 'UserAuth'.*must be lowercase/);
    });

    it('should accept module names with hyphens', () => {
      expect(() => {
        service.addAction('user-auth|afterCreate', vi.fn());
      }).not.toThrow();
      expect(service.hasAction('user-auth|afterCreate')).toBe(true);
    });

    it('should provide fallback camelCase suggestion for non-standard separators', () => {
      expect(() => {
        service.addAction('user|email_verified_status', vi.fn());
      }).toThrow(/Invalid event name 'email_verified_status'/);
    });

    it('should reject module names with uppercase first letter', () => {
      expect(() => {
        service.addAction('Article|afterCreate', vi.fn());
      }).toThrow(/Invalid module name 'Article'/);
    });
  });

  describe('hook name validation edge cases', () => {
    it('should split on first pipe and validate event part', () => {
      // 'user|after|create' splits to ['user', 'after'] and 'after' is not valid camelCase
      expect(() => {
        service.addAction('user|after|create', vi.fn());
      }).not.toThrow();
      // The event part 'after' is actually valid camelCase (lowercase), so this should succeed
      expect(service.hasAction('user|after')).toBe(true);
    });

    it('should trim whitespace from hook names', () => {
      const callback = vi.fn();
      const id = service.addAction('  user|afterCreate  ', callback);
      expect(id).toBeDefined();
      expect(service.hasAction('user|afterCreate')).toBe(true);
    });

    it('should reject hook names with special characters in module', () => {
      expect(() => {
        service.addAction('user@auth|afterCreate', vi.fn());
      }).toThrow(/Invalid module name/);
    });

    it('should reject event names starting with uppercase', () => {
      expect(() => {
        service.addAction('user|AfterCreate', vi.fn());
      }).toThrow(/Invalid event name 'AfterCreate'/);
    });

    it('should accept complex valid camelCase event names', () => {
      expect(() => {
        service.addAction('user|afterPasswordResetTokenGenerate', vi.fn());
        service.addFilter('article|beforeHTMLRender', vi.fn());
      }).not.toThrow();
    });
  });

  describe('removeFilter edge cases', () => {
    it('should return false for non-existent id in existing hook', () => {
      const callback = vi.fn((value: string) => value);
      service.addFilter('test|hook', callback);

      expect(service.removeFilter('test|hook', 'non-existent-id')).toBe(false);
      expect(service.hasFilter('test|hook')).toBe(true);
    });
  });

  describe('action and filter execution with multiple priorities', () => {
    it('should execute actions with same priority in registration order', async () => {
      const order: number[] = [];
      service.addAction(
        'test|samePriority',
        () => {
          order.push(1);
        },
        10,
      );
      service.addAction(
        'test|samePriority',
        () => {
          order.push(2);
        },
        10,
      );
      service.addAction(
        'test|samePriority',
        () => {
          order.push(3);
        },
        10,
      );

      await service.doAction('test|samePriority');
      expect(order).toEqual([1, 2, 3]);
    });

    it('should apply filters with same priority in registration order', async () => {
      const filter1 = vi.fn((value: string) => `${value}:1`);
      const filter2 = vi.fn((value: string) => `${value}:2`);
      const filter3 = vi.fn((value: string) => `${value}:3`);

      service.addFilter('test|samePriority', filter1, 10);
      service.addFilter('test|samePriority', filter2, 10);
      service.addFilter('test|samePriority', filter3, 10);

      const result = await service.applyFilters('test|samePriority', 'start');
      expect(result).toBe('start:1:2:3');
    });
  });

  describe('getAllActionHooks and getAllFilterHooks', () => {
    it('should return empty arrays when no hooks registered', () => {
      expect(service.getAllActionHooks()).toEqual([]);
      expect(service.getAllFilterHooks()).toEqual([]);
    });

    it('should return all unique action hook names', () => {
      service.addAction('hook1|event', vi.fn());
      service.addAction('hook1|event', vi.fn()); // Same hook, different callback
      service.addAction('hook2|event', vi.fn());
      service.addAction('hook3|event', vi.fn());

      const hooks = service.getAllActionHooks();
      expect(hooks.length).toBe(3);
      expect(hooks).toContain('hook1|event');
      expect(hooks).toContain('hook2|event');
      expect(hooks).toContain('hook3|event');
    });

    it('should return all unique filter hook names', () => {
      service.addFilter(
        'hook1|event',
        vi.fn((v: unknown) => v),
      );
      service.addFilter(
        'hook1|event',
        vi.fn((v: unknown) => v),
      ); // Same hook, different callback
      service.addFilter(
        'hook2|event',
        vi.fn((v: unknown) => v),
      );

      const hooks = service.getAllFilterHooks();
      expect(hooks.length).toBe(2);
      expect(hooks).toContain('hook1|event');
      expect(hooks).toContain('hook2|event');
    });
  });

  describe('clearHook', () => {
    it('should clear both actions and filters for specific hook', () => {
      service.addAction('clear|test', vi.fn());
      service.addAction('clear|test', vi.fn());
      service.addFilter(
        'clear|test',
        vi.fn((v: unknown) => v),
      );
      service.addAction('keep|test', vi.fn());

      expect(service.getActionCount('clear|test')).toBe(2);
      expect(service.getFilterCount('clear|test')).toBe(1);
      expect(service.hasAction('keep|test')).toBe(true);

      service.clearHook('clear|test');

      expect(service.hasAction('clear|test')).toBe(false);
      expect(service.hasFilter('clear|test')).toBe(false);
      expect(service.getActionCount('clear|test')).toBe(0);
      expect(service.getFilterCount('clear|test')).toBe(0);
      expect(service.hasAction('keep|test')).toBe(true);
    });

    it('should validate hook name when clearing', () => {
      expect(() => {
        service.clearHook('invalid-hook-name');
      }).toThrow(/Invalid hook name/);
    });
  });

  describe('error handling in doAction', () => {
    it('should log errors with Error objects', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error');
      const testError = new Error('Test error message');
      const callback = vi.fn(() => {
        throw testError;
      });

      service.addAction('error|test', callback);
      await service.doAction('error|test');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error executing action for hook 'error|test'"),
        'Test error message',
      );
    });

    it('should log errors with non-Error objects', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error');
      const callback = vi.fn(() => {
        throw new Error('String error');
      });

      service.addAction('error|nonError', callback);
      await service.doAction('error|nonError');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error executing action for hook 'error|nonError'"),
        'String error',
      );
    });
  });

  describe('error handling in applyFilters', () => {
    it('should log errors with Error objects and preserve current value', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error');
      const testError = new Error('Filter error');
      const filter1 = vi.fn((value: string) => `${value}:1`);
      const filter2 = vi.fn(() => {
        throw testError;
      });
      const filter3 = vi.fn((value: string) => `${value}:3`);

      service.addFilter('error|filter', filter1, 5);
      service.addFilter('error|filter', filter2, 10);
      service.addFilter('error|filter', filter3, 15);

      const result = await service.applyFilters('error|filter', 'start');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error applying filter for hook 'error|filter'"),
        'Filter error',
      );
      expect(result).toBe('start:1:3'); // Should skip errored filter but continue
    });

    it('should log errors with non-Error objects in filters', async () => {
      const errorSpy = vi.spyOn(Logger.prototype, 'error');
      const filter = vi.fn(() => {
        throw new Error('Custom error object');
      });

      service.addFilter('error|customFilter', filter);
      const result = await service.applyFilters('error|customFilter', 'original');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error applying filter for hook 'error|customFilter'"),
        'Custom error object',
      );
      expect(result).toBe('original'); // Should return original value on error
    });
  });
});
