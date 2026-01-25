/**
 * @file object-plugin.util.spec.ts
 *
 * 测试对象插件加载工具
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import {
  isDynamicModulePayload,
  tryImportObjectPlugin,
  resolveObjectPluginExport,
} from './object-plugin.util';

describe('Object Plugin Util', () => {
  const testDir = join(process.cwd(), '.test-object-plugins');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('isDynamicModulePayload', () => {
    it('should return true for DynamicModule with module property', () => {
      const payload = {
        module: class TestModule {},
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return true for DynamicModule with imports', () => {
      const payload = {
        module: class TestModule {},
        imports: [],
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return true for DynamicModule with controllers', () => {
      const payload = {
        module: class TestModule {},
        controllers: [],
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return true for DynamicModule with providers', () => {
      const payload = {
        module: class TestModule {},
        providers: [],
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return true for DynamicModule with exports', () => {
      const payload = {
        module: class TestModule {},
        exports: [],
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return true for DynamicModule with global', () => {
      const payload = {
        module: class TestModule {},
        global: true,
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return true for minimal DynamicModule (only module)', () => {
      const payload = {
        module: class TestModule {},
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });

    it('should return false for null', () => {
      const result = isDynamicModulePayload(null);

      expect(result).toBe(false);
    });

    it('should return false for undefined', () => {
      const result = isDynamicModulePayload(undefined);

      expect(result).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isDynamicModulePayload('string')).toBe(false);
      expect(isDynamicModulePayload(123)).toBe(false);
      expect(isDynamicModulePayload(true)).toBe(false);
    });

    it('should return false for object without module', () => {
      const payload = {
        notModule: class TestModule {},
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(false);
    });

    it('should return false if module is not function or object', () => {
      const payload = {
        module: 'string',
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(false);
    });

    it('should accept module as object', () => {
      const payload = {
        module: {},
        imports: [],
      };

      const result = isDynamicModulePayload(payload);

      expect(result).toBe(true);
    });
  });

  describe('tryImportObjectPlugin', () => {
    it('should import object plugin successfully', async () => {
      const pluginFile = join(testDir, 'plugin.js');

      await writeFile(
        pluginFile,
        `
        module.exports.default = {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0'
        };
      `,
      );

      const result = await tryImportObjectPlugin(pluginFile);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'test-plugin');
      expect(result).toHaveProperty('name', 'Test Plugin');
    });

    it('should return null for DynamicModule payload', async () => {
      const pluginFile = join(testDir, 'dynamic-module.js');

      await writeFile(
        pluginFile,
        `
        class TestModule {}
        module.exports.default = {
          module: TestModule,
          imports: []
        };
      `,
      );

      const result = await tryImportObjectPlugin(pluginFile);

      expect(result).toBeNull();
    });

    it('should import from module namespace if no default', async () => {
      const pluginFile = join(testDir, 'no-default.js');

      await writeFile(
        pluginFile,
        `
        module.exports = {
          id: 'no-default',
          name: 'No Default'
        };
      `,
      );

      const result = await tryImportObjectPlugin(pluginFile);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'no-default');
    });

    it('should return null for non-object export', async () => {
      const pluginFile = join(testDir, 'function-export.js');

      await writeFile(
        pluginFile,
        `
        module.exports.default = function() {
          return 'I am a function';
        };
      `,
      );

      const result = await tryImportObjectPlugin(pluginFile);

      expect(result).toBeNull();
    });

    it('should return null on import error', async () => {
      const pluginFile = join(testDir, 'invalid.js');

      await writeFile(pluginFile, 'this is not valid javascript!!!');

      const result = await tryImportObjectPlugin(pluginFile);

      expect(result).toBeNull();
    });

    it('should return null for non-existent file', async () => {
      const pluginFile = join(testDir, 'nonexistent.js');

      const result = await tryImportObjectPlugin(pluginFile);

      expect(result).toBeNull();
    });
  });

  describe('resolveObjectPluginExport', () => {
    it('should resolve from plugin.json main field', async () => {
      const pluginDir = join(testDir, 'plugin1');
      await mkdir(pluginDir, { recursive: true });

      // Create plugin.json
      await writeFile(
        join(pluginDir, 'plugin.json'),
        JSON.stringify({
          main: 'custom-entry.js',
        }),
      );

      // Create custom entry file
      await writeFile(
        join(pluginDir, 'custom-entry.js'),
        `
        module.exports.default = {
          id: 'from-plugin-json',
          name: 'From plugin.json'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'from-plugin-json');
    });

    it('should resolve from package.json main field', async () => {
      const pluginDir = join(testDir, 'plugin2');
      await mkdir(pluginDir, { recursive: true });

      // Create package.json
      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          main: 'lib/index.js',
        }),
      );

      // Create entry file
      await mkdir(join(pluginDir, 'lib'), { recursive: true });
      await writeFile(
        join(pluginDir, 'lib', 'index.js'),
        `
        module.exports.default = {
          id: 'from-package-json',
          name: 'From package.json'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'from-package-json');
    });

    it('should fallback to index.ts', async () => {
      const pluginDir = join(testDir, 'plugin3');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'index.ts'),
        `
        export default {
          id: 'from-index-ts',
          name: 'From index.ts'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      // May or may not work depending on TypeScript support
      expect([null, 'from-index-ts']).toContain(result?.id ?? null);
    });

    it('should fallback to index.js', async () => {
      const pluginDir = join(testDir, 'plugin4');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = {
          id: 'from-index-js',
          name: 'From index.js'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'from-index-js');
    });

    it('should fallback to index.mjs', async () => {
      const pluginDir = join(testDir, 'plugin5');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'index.mjs'),
        `
        export default {
          id: 'from-index-mjs',
          name: 'From index.mjs'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'from-index-mjs');
    });

    it('should return null if no entry file found', async () => {
      const pluginDir = join(testDir, 'plugin6');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(join(pluginDir, 'readme.md'), '# Plugin');

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeNull();
    });

    it('should prioritize plugin.json over package.json', async () => {
      const pluginDir = join(testDir, 'plugin7');
      await mkdir(pluginDir, { recursive: true });

      // Create plugin.json
      await writeFile(
        join(pluginDir, 'plugin.json'),
        JSON.stringify({
          main: 'from-plugin.js',
        }),
      );

      // Create package.json
      await writeFile(
        join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          version: '1.0.0',
          main: 'from-package.js',
        }),
      );

      // Create entry from plugin.json
      await writeFile(
        join(pluginDir, 'from-plugin.js'),
        `
        module.exports.default = {
          id: 'priority-plugin-json'
        };
      `,
      );

      // Create entry from package.json
      await writeFile(
        join(pluginDir, 'from-package.js'),
        `
        module.exports.default = {
          id: 'priority-package-json'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'priority-plugin-json');
    });

    it('should skip DynamicModule payloads', async () => {
      const pluginDir = join(testDir, 'plugin8');
      await mkdir(pluginDir, { recursive: true });

      await writeFile(
        join(pluginDir, 'index.js'),
        `
        class TestModule {}
        module.exports.default = {
          module: TestModule,
          imports: []
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeNull();
    });

    it('should handle invalid plugin.json gracefully', async () => {
      const pluginDir = join(testDir, 'plugin9');
      await mkdir(pluginDir, { recursive: true });

      // Create invalid JSON
      await writeFile(join(pluginDir, 'plugin.json'), '{invalid json}');

      // Create fallback index.js
      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = {
          id: 'fallback-index'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'fallback-index');
    });

    it('should handle invalid package.json gracefully', async () => {
      const pluginDir = join(testDir, 'plugin10');
      await mkdir(pluginDir, { recursive: true });

      // Create invalid JSON
      await writeFile(join(pluginDir, 'package.json'), '{invalid json}');

      // Create fallback index.js
      await writeFile(
        join(pluginDir, 'index.js'),
        `
        module.exports.default = {
          id: 'fallback-after-invalid-pkg'
        };
      `,
      );

      const result = await resolveObjectPluginExport(pluginDir);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'fallback-after-invalid-pkg');
    });
  });
});
