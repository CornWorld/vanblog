import './setup.unit';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { PluginDataValidator } from '../src/modules/plugin/services/plugin-data.validator';

describe('PluginDataValidator', () => {
  const validator = new PluginDataValidator();

  it('validates with schema: pass', () => {
    const schema = z.object({ a: z.string() });
    const res = validator.validatePluginData('plugin-x', { a: 'ok' }, schema);
    expect(res.valid).toBeTruthy();
    const norm = validator.normalizeProviderResult('plugin-x', { schema, data: { a: 'ok' } });
    expect(norm).toEqual({ a: 'ok' });
  });

  it('validates with schema: fail -> dropped', () => {
    const schema = z.object({ a: z.string() });
    const res = validator.validatePluginData('plugin-x', { a: 1 }, schema);
    expect(res.valid).toBeFalsy();
    expect(res.errors?.length).toBeGreaterThan(0);
    const norm = validator.normalizeProviderResult('plugin-x', { schema, data: { a: 1 } });
    expect(norm).toBeUndefined();
  });

  it('no schema envelope but serializable data -> returns data', () => {
    const norm = validator.normalizeProviderResult('plugin-y', { data: { b: 1, ok: true } });
    expect(norm).toEqual({ b: 1, ok: true });
  });

  it('no schema envelope but non-serializable data -> dropped', () => {
    const cyc: any = { x: 1 };
    cyc.self = cyc; // circular reference
    const norm = validator.normalizeProviderResult('plugin-y', { data: cyc });
    expect(norm).toBeUndefined();
  });

  it('plain serializable value -> returned as is', () => {
    expect(validator.normalizeProviderResult('plugin-z', 'hello')).toBe('hello');
    expect(validator.normalizeProviderResult('plugin-z', 123)).toBe(123);
    expect(validator.normalizeProviderResult('plugin-z', { k: 'v' })).toEqual({ k: 'v' });
  });

  it('plain non-serializable value -> dropped', () => {
    expect(validator.normalizeProviderResult('plugin-z', () => 1)).toBeUndefined();
    expect(validator.normalizeProviderResult('plugin-z', Symbol('x'))).toBeUndefined();
    // BigInt is not JSON-serializable
    expect(validator.normalizeProviderResult('plugin-z', BigInt(1))).toBeUndefined();
  });
});
