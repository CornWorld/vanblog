import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LoaderService } from './loader.service';

import type { LoggerService } from '../../../core/logger/logger.service';

type MinimalLogger = Pick<LoggerService, 'log' | 'warn' | 'error' | 'debug'>;

type VersionHelpers = {
  parseVersion: (v: string) => [number, number, number];
  satisfiesVanblogEngine: (r: string, v: string) => boolean;
};

// Minimal mocks for dependencies; we won't use them in these tests
const createService = (): { service: LoaderService; logger: MinimalLogger } => {
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as MinimalLogger;

  const pluginContextFactory = {
    createContext: vi.fn(),
  } as unknown as import('./plugin-context.service').PluginContextFactory;

  const hookService = {
    addAction: vi.fn(),
    addFilter: vi.fn(),
    clearAll: vi.fn(),
  } as unknown as import('./hook.service').HookService;

  return {
    service: new LoaderService(logger as any, pluginContextFactory, hookService),
    logger,
  };
};

describe('LoaderService version utilities', () => {
  let service: LoaderService;
  let logger: MinimalLogger;
  let parseVersion: VersionHelpers['parseVersion'];
  let satisfies: VersionHelpers['satisfiesVanblogEngine'];

  beforeEach(() => {
    ({ service, logger } = createService());

    const { parseVersion: pv, satisfiesVanblogEngine: sv } = service as unknown as VersionHelpers;
    parseVersion = pv.bind(service);
    satisfies = sv.bind(service);
  });
  it('parseVersion should parse semantic versions and default missing parts to 0', () => {
    expect(parseVersion('2.1.3')).toEqual([2, 1, 3]);
    expect(parseVersion('2.1')).toEqual([2, 1, 0]);
    expect(parseVersion('2')).toEqual([2, 0, 0]);
    expect(parseVersion('')).toEqual([0, 0, 0]);
  });

  it('satisfiesVanblogEngine should support caret ranges', () => {
    expect(satisfies('^2.0.0', '2.0.0')).toBe(true);
    expect(satisfies('^2.0.0', '2.5.4')).toBe(true);
    expect(satisfies('^2.0.0', '3.0.0')).toBe(false);
    expect(satisfies('^2.0.0', '1.9.9')).toBe(false);
  });

  it('satisfiesVanblogEngine should support tilde ranges', () => {
    expect(satisfies('~2.1.3', '2.1.3')).toBe(true);
    expect(satisfies('~2.1.3', '2.1.9')).toBe(true);
    expect(satisfies('~2.1.3', '2.2.0')).toBe(false);
    expect(satisfies('~2.1.3', '2.0.9')).toBe(false);
  });

  it('satisfiesVanblogEngine should support comparison operators', () => {
    expect(satisfies('>=2.1.0', '2.1.0')).toBe(true);
    expect(satisfies('>=2.1.0', '2.0.9')).toBe(false);
    expect(satisfies('> 2.1.0', '2.1.1')).toBe(true);
    expect(satisfies('> 2.1.0', '2.1.0')).toBe(false);
    expect(satisfies('<=2.1.0', '2.1.0')).toBe(true);
    expect(satisfies('<=2.1.0', '2.1.1')).toBe(false);
    expect(satisfies('< 2.1.0', '2.0.9')).toBe(true);
    expect(satisfies('< 2.1.0', '2.1.0')).toBe(false);
  });

  it('satisfiesVanblogEngine should support exact versions', () => {
    expect(satisfies('2.1.3', '2.1.3')).toBe(true);
    expect(satisfies('2.1.3', '2.1.4')).toBe(false);
  });

  it("satisfiesVanblogEngine should support '2' (major only) and '2.1' (major.minor)", () => {
    expect(satisfies('2', '2.0.0')).toBe(true);
    expect(satisfies('2', '2.5.4')).toBe(true);
    expect(satisfies('2', '3.0.0')).toBe(false);

    expect(satisfies('2.1', '2.1.0')).toBe(true);
    expect(satisfies('2.1', '2.1.9')).toBe(true);
    expect(satisfies('2.1', '2.2.0')).toBe(false);
  });

  it('satisfiesVanblogEngine should allow unknown patterns and log a warning', () => {
    const result = satisfies('foo', '2.1.0');
    expect(result).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });
});
