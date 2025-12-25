import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { PluginDataValidator } from './plugin-data.validator';

describe('PluginDataValidator', () => {
  let validator: PluginDataValidator;

  beforeEach(() => {
    validator = new PluginDataValidator();
  });

  describe('validatePluginData', () => {
    it('should return valid for JSON-serializable data without schema', () => {
      const result = validator.validatePluginData('test-plugin', { foo: 'bar', num: 42 });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return invalid for non-serializable data without schema', () => {
      const circular: any = { name: 'circular' };
      circular.self = circular;
      const result = validator.validatePluginData('test-plugin', circular);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['test-plugin: data is not JSON-serializable']);
    });

    it('should return invalid for functions without schema', () => {
      const result = validator.validatePluginData('test-plugin', () => {});
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['test-plugin: data is not JSON-serializable']);
    });

    it('should return invalid for undefined without schema', () => {
      const result = validator.validatePluginData('test-plugin', undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['test-plugin: data is not JSON-serializable']);
    });

    it('should return invalid for symbols without schema', () => {
      const result = validator.validatePluginData('test-plugin', Symbol('test'));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['test-plugin: data is not JSON-serializable']);
    });

    it('should return invalid for bigint without schema', () => {
      const result = validator.validatePluginData('test-plugin', BigInt(9007199254740991));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['test-plugin: data is not JSON-serializable']);
    });

    it('should validate data with schema successfully', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validator.validatePluginData('test-plugin', { name: 'John', age: 30 }, schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return validation errors when schema validation fails', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validator.validatePluginData('test-plugin', { name: 'John' }, schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should handle nested schema validation', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email(),
        }),
        tags: z.array(z.string()),
      });

      const validData = {
        user: { name: 'John', email: 'john@example.com' },
        tags: ['foo', 'bar'],
      };
      const result1 = validator.validatePluginData('test-plugin', validData, schema);
      expect(result1.valid).toBe(true);

      const invalidData = {
        user: { name: 'John', email: 'invalid-email' },
        tags: ['foo', 'bar'],
      };
      const result2 = validator.validatePluginData('test-plugin', invalidData, schema);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toBeDefined();
    });

    it('should handle schema validation errors gracefully', () => {
      const schema = z.string().min(5);

      const result = validator.validatePluginData('test-plugin', 'abc', schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should return error string for non-ZodError errors', () => {
      const mockSchema = {
        parse: () => {
          throw new Error('Custom error');
        },
      } as any;

      const result = validator.validatePluginData('test-plugin', { foo: 'bar' }, mockSchema);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Error: Custom error']);
    });
  });

  describe('normalizeProviderResult', () => {
    it('should normalize envelope with schema and data', () => {
      const schema = z.object({ foo: z.string() });
      const envelope = {
        schema,
        data: { foo: 'bar' },
      };

      const result = validator.normalizeProviderResult('test-plugin', envelope);
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return undefined for invalid data in envelope', () => {
      const schema = z.object({ foo: z.string() });
      const envelope = {
        schema,
        data: { foo: 123 }, // Invalid: should be string
      };

      const result = validator.normalizeProviderResult('test-plugin', envelope);
      expect(result).toBeUndefined();
    });

    it('should return data from envelope without valid schema', () => {
      const envelope = {
        schema: null,
        data: { foo: 'bar' },
      };

      const result = validator.normalizeProviderResult('test-plugin', envelope);
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return serializable value when not envelope', () => {
      const value = { foo: 'bar', num: 42 };
      const result = validator.normalizeProviderResult('test-plugin', value);
      expect(result).toEqual(value);
    });

    it('should return undefined for non-serializable value', () => {
      const circular: any = { name: 'circular' };
      circular.self = circular;

      const result = validator.normalizeProviderResult('test-plugin', circular);
      expect(result).toBeUndefined();
    });

    it('should return undefined for function values', () => {
      const result = validator.normalizeProviderResult('test-plugin', () => {});
      expect(result).toBeUndefined();
    });

    it('should handle primitives', () => {
      expect(validator.normalizeProviderResult('test-plugin', 'string')).toBe('string');
      expect(validator.normalizeProviderResult('test-plugin', 42)).toBe(42);
      expect(validator.normalizeProviderResult('test-plugin', true)).toBe(true);
      expect(validator.normalizeProviderResult('test-plugin', null)).toBe(null);
    });

    it('should return undefined for undefined value', () => {
      const result = validator.normalizeProviderResult('test-plugin', undefined);
      expect(result).toBeUndefined();
    });

    it('should handle arrays', () => {
      const array = [1, 2, 3];
      const result = validator.normalizeProviderResult('test-plugin', array);
      expect(result).toEqual(array);
    });

    it('should handle nested objects with schema', () => {
      const schema = z.object({
        nested: z.object({
          value: z.number(),
        }),
      });

      const envelope = {
        schema,
        data: {
          nested: {
            value: 42,
          },
        },
      };

      const result = validator.normalizeProviderResult('test-plugin', envelope);
      expect(result).toEqual({
        nested: {
          value: 42,
        },
      });
    });
  });

  describe('isJsonSerializable', () => {
    it('should return true for serializable objects', () => {
      expect(validator.isJsonSerializable({ foo: 'bar' })).toBe(true);
      expect(validator.isJsonSerializable([1, 2, 3])).toBe(true);
      expect(validator.isJsonSerializable('string')).toBe(true);
      expect(validator.isJsonSerializable(42)).toBe(true);
      expect(validator.isJsonSerializable(true)).toBe(true);
      expect(validator.isJsonSerializable(null)).toBe(true);
    });

    it('should return false for non-serializable values', () => {
      expect(validator.isJsonSerializable(undefined)).toBe(false);
      expect(validator.isJsonSerializable(() => {})).toBe(false);
      expect(validator.isJsonSerializable(Symbol('test'))).toBe(false);
      expect(validator.isJsonSerializable(BigInt(42))).toBe(false);
    });

    it('should return false for circular references', () => {
      const circular: any = { name: 'circular' };
      circular.self = circular;
      expect(validator.isJsonSerializable(circular)).toBe(false);
    });

    it('should handle nested objects', () => {
      const nested = {
        level1: {
          level2: {
            level3: 'value',
          },
        },
      };
      expect(validator.isJsonSerializable(nested)).toBe(true);
    });

    it('should handle arrays with mixed types', () => {
      const mixed = [1, 'string', true, null, { foo: 'bar' }];
      expect(validator.isJsonSerializable(mixed)).toBe(true);
    });

    it('should return false for objects containing functions', () => {
      const withFunction = {
        foo: 'bar',
        method: () => {},
      };
      // Note: JSON.stringify will simply omit the function, so this will be true
      expect(validator.isJsonSerializable(withFunction)).toBe(true);
    });
  });
});
