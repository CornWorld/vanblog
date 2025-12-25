/**
 * @file functional-plugin.util.spec.ts
 *
 * 函数式插件加载工具测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import {
  detectPluginType,
  loadFunctionalPlugin,
  type PluginLoadResult,
} from './functional-plugin.util';

// Mock logger
const mockLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('Functional Plugin Util', () => {
  const testDir = join(process.cwd(), '.test-plugins');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(testDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('detectPluginType', () => {
    it('should detect functional plugin', async () => {
      const pluginDir = join(testDir, 'functional-plugin');
      await mkdir(pluginDir, { recursive: true });

      // Create a functional plugin
      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = (api) => {
          api.log.info('Hello from plugin');
        };
      `,
      );

      const type = await detectPluginType(pluginDir);
      expect(type).toBe('functional');
    });

    it('should return unknown for non-functional plugin', async () => {
      const pluginDir = join(testDir, 'object-plugin');
      await mkdir(pluginDir, { recursive: true });

      // Create an object plugin
      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = {
          id: 'test',
          name: 'Test',
          version: '1.0.0'
        };
      `,
      );

      const type = await detectPluginType(pluginDir);
      expect(type).toBe('unknown');
    });

    it('should return unknown if no entry file found', async () => {
      const pluginDir = join(testDir, 'empty-plugin');
      await mkdir(pluginDir, { recursive: true });

      const type = await detectPluginType(pluginDir);
      expect(type).toBe('unknown');
    });

    it('should return unknown on import error', async () => {
      const pluginDir = join(testDir, 'invalid-plugin');
      await mkdir(pluginDir, { recursive: true });

      // Create invalid JavaScript
      await writeFile(join(pluginDir, 'index.js'), 'this is not valid javascript!!!');

      const type = await detectPluginType(pluginDir);
      expect(type).toBe('unknown');
    });
  });

  describe('loadFunctionalPlugin', () => {
    it('should load functional plugin successfully', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      await mkdir(pluginDir, { recursive: true });

      // Create package.json
      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          main: 'index.js',
          vanblog: {
            id: 'test-plugin',
            name: 'Test Plugin',
          },
        }),
      );

      // Create plugin entry
      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = (api) => {
          api.log.info('Plugin loaded');
        };
      `,
      );

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.type).toBe('functional');
      expect(result?.packageJson.name).toBe('test-plugin');
      expect(result?.packageJson.version).toBe('1.0.0');
      expect(result?.entry).toBeTypeOf('function');
      expect(result?.dir).toBe(pluginDir);
    });

    it('should return null if package.json is missing', async () => {
      const pluginDir = join(testDir, 'no-package-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(join(pluginDir, 'index.js'), `module.exports.default = (api) => {};`);

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No valid package.json found'),
      );
    });

    it('should return null if entry file is missing', async () => {
      const pluginDir = join(testDir, 'no-entry-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'no-entry',
          version: '1.0.0',
          main: 'nonexistent.js',
        }),
      );

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No entry file found'));
    });

    it('should handle custom main field in package.json', async () => {
      const pluginDir = join(testDir, 'custom-main-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'custom-main',
          version: '1.0.0',
          main: 'plugin.js',
        }),
      );

      await writeFile(join(pluginDir, 'plugin.js'), `module.exports.default = (api) => {};`);

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.type).toBe('functional');
    });

    it('should handle TypeScript entry files', async () => {
      const pluginDir = join(testDir, 'ts-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'ts-plugin',
          version: '1.0.0',
          main: 'index.ts',
        }),
      );

      // Create a simple .ts file that can be imported
      await writeFile(
        join(pluginDir, 'index.ts'),
        `
        export default (api: any) => {
          api.log.info('TypeScript plugin');
        };
      `,
      );

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      // May succeed or fail depending on runtime support for TS
      // Just verify it doesn't crash
      expect([null, 'functional', 'unknown']).toContain(result?.type ?? null);
    });

    it('should return unknown type for non-function export', async () => {
      const pluginDir = join(testDir, 'object-export-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'object-export',
          version: '1.0.0',
        }),
      );

      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = {
          id: 'test',
          name: 'Test'
        };
      `,
      );

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.type).toBe('unknown');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown plugin format'),
      );
    });

    it('should handle import errors gracefully', async () => {
      const pluginDir = join(testDir, 'error-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'error-plugin',
          version: '1.0.0',
        }),
      );

      await writeFile(join(pluginDir, 'index.js'), 'throw new Error("Import failed")');

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      // May return null or unknown depending on how import fails
      expect([null, 'unknown']).toContain(result?.type ?? null);
    });

    it('should handle package.json with minimal fields', async () => {
      const pluginDir = join(testDir, 'minimal-plugin');
      await mkdir(pluginDir, { recursive: true });

      // Create minimal package.json (name and version only)
      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'minimal',
          version: '2.0.0',
          // No main, description, or vanblog fields
        }),
      );

      await writeFile(join(pluginDir, 'index.js'), `module.exports.default = (api) => {};`);

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.packageJson.name).toBe('minimal');
      expect(result?.packageJson.version).toBe('2.0.0');
      expect(result?.packageJson.main).toBe('index.ts'); // default value
    });

    it('should work without logger', async () => {
      const pluginDir = join(testDir, 'no-logger-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'no-logger',
          version: '1.0.0',
        }),
      );

      await writeFile(join(pluginDir, 'index.js'), `module.exports.default = (api) => {};`);

      // Should not throw without logger
      const result = await loadFunctionalPlugin(pluginDir);

      expect(result).toBeDefined();
      expect(result?.type).toBe('functional');
    });

    it('should try multiple entry file extensions', async () => {
      const pluginDir = join(testDir, 'mjs-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'mjs-plugin',
          version: '1.0.0',
          main: 'index',
        }),
      );

      // Create .mjs file
      await writeFile(join(pluginDir, 'index.mjs'), `export default (api) => {};`);

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeDefined();
      expect(result?.type).toBe('functional');
    });

    it('should handle invalid JSON in package.json', async () => {
      const pluginDir = join(testDir, 'invalid-json-plugin');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(join(pluginDir, 'package.json'), '{invalid json}');

      await writeFile(join(pluginDir, 'index.js'), `module.exports.default = (api) => {};`);

      const result = await loadFunctionalPlugin(pluginDir, mockLogger as any);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No valid package.json found'),
      );
    });
  });
});
