import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { jsonSchema, jsonSchemaOptional, jsonSchemaWithDefault } from './json-schema.js';

describe('jsonSchema (deprecated)', () => {
  const TestSchema = z.object({
    name: z.string(),
    age: z.number(),
    active: z.boolean(),
  });

  describe('jsonSchema()', () => {
    it('should now just return the schema (deprecated behavior)', () => {
      const schema = jsonSchema(TestSchema);
      const input = { name: 'John', age: 30, active: true };
      const result = schema.parse(input);

      expect(result).toEqual(input);
    });

    it('should preserve type inference', () => {
      const schema = jsonSchema(TestSchema);
      const result = schema.parse({ name: 'John', age: 30, active: true });

      // TypeScript type check (compile-time)
      const name: string = result.name;
      const age: number = result.age;
      const active: boolean = result.active;

      expect(name).toBe('John');
      expect(age).toBe(30);
      expect(active).toBe(true);
    });
  });

  describe('jsonSchemaOptional()', () => {
    it('should allow null', () => {
      const schema = jsonSchemaOptional(TestSchema);
      const result = schema.parse(null);

      expect(result).toBeNull();
    });

    it('should allow undefined', () => {
      const schema = jsonSchemaOptional(TestSchema);
      const result = schema.parse(undefined);

      expect(result).toBeUndefined();
    });

    it('should parse valid object', () => {
      const schema = jsonSchemaOptional(TestSchema);
      const input = { name: 'Jane', age: 25, active: false };
      const result = schema.parse(input);

      expect(result).toEqual(input);
    });
  });

  describe('jsonSchemaWithDefault()', () => {
    const defaultValue = { name: 'Default', age: 0, active: false };

    it('should use default on validation error', () => {
      const schema = jsonSchemaWithDefault(TestSchema, defaultValue);
      const input = { name: 'John', age: 'invalid' as unknown as number, active: true };
      const result = schema.parse(input);

      expect(result).toEqual(defaultValue);
    });

    it('should parse valid object', () => {
      const schema = jsonSchemaWithDefault(TestSchema, defaultValue);
      const input = { name: 'Bob', age: 35, active: true };
      const result = schema.parse(input);

      expect(result).toEqual(input);
    });
  });
});
