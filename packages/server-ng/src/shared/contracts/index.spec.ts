import { describe, it, expect } from 'vitest';
import {
  // Migration Data
  createDefaultMigrationData,
  normalizeMigrationData,
  isMigrationData,
  type MigrationData,
  // Comment Configuration
  createDefaultCommentOtherConfig,
  normalizeCommentOtherConfig,
  // Custom Code
  createDefaultCustomCode,
  normalizeCustomCode,
  isCustomCode,
  type CustomCode,
  // Media Processing
  createDefaultMediaProcessingConfig,
  normalizeMediaProcessingConfig,
  isMediaProcessingConfig,
  // Media Processing Override
  createDefaultMediaProcessingOverride,
  normalizeMediaProcessingOverride,
  // Request Parameters
  createDefaultRequestParams,
  createDefaultRequestQuery,
  normalizeRequestParams,
  normalizeRequestQuery,
} from './index';

describe('Migration Data Contract', () => {
  describe('createDefaultMigrationData', () => {
    it('should create empty migration data', () => {
      const data = createDefaultMigrationData();

      expect(data).toEqual({ migrations: [] });
      expect(data.migrations).toHaveLength(0);
    });
  });

  describe('normalizeMigrationData', () => {
    it('should normalize valid migration data', () => {
      const raw = {
        migrations: [
          {
            id: 'migration-1',
            name: 'Initial Setup',
            executedAt: new Date('2024-01-01'),
            version: '1.0.0',
          },
        ],
      };

      const normalized = normalizeMigrationData(raw);

      expect(normalized.migrations).toHaveLength(1);
      expect(normalized.migrations[0].id).toBe('migration-1');
      expect(normalized.migrations[0].name).toBe('Initial Setup');
      expect(normalized.migrations[0].version).toBe('1.0.0');
    });

    it('should handle null input', () => {
      const normalized = normalizeMigrationData(null);

      expect(normalized).toEqual({ migrations: [] });
    });

    it('should handle undefined input', () => {
      const normalized = normalizeMigrationData(undefined);

      expect(normalized).toEqual({ migrations: [] });
    });

    it('should handle non-object input', () => {
      expect(normalizeMigrationData('string')).toEqual({ migrations: [] });
      expect(normalizeMigrationData(123)).toEqual({ migrations: [] });
      expect(normalizeMigrationData(true)).toEqual({ migrations: [] });
    });

    it('should handle missing migrations array', () => {
      const raw = { other: 'data' };
      const normalized = normalizeMigrationData(raw);

      expect(normalized).toEqual({ migrations: [] });
    });

    it('should handle invalid migrations array', () => {
      const raw = { migrations: 'not-an-array' };
      const normalized = normalizeMigrationData(raw);

      expect(normalized).toEqual({ migrations: [] });
    });

    it('should normalize invalid migration records', () => {
      const raw = {
        migrations: [null, undefined, 'invalid', {}, { id: 123, name: null }],
      };

      const normalized = normalizeMigrationData(raw);

      expect(normalized.migrations).toHaveLength(5);
      // All records should have default values
      normalized.migrations.forEach((record) => {
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('name');
        expect(record).toHaveProperty('executedAt');
        expect(record).toHaveProperty('version');
      });
    });

    it('should handle partial migration records', () => {
      const raw = {
        migrations: [
          { id: 'test-id' },
          { name: 'test-name' },
          { version: '2.0.0' },
          { executedAt: new Date() },
        ],
      };

      const normalized = normalizeMigrationData(raw);

      expect(normalized.migrations).toHaveLength(4);
      expect(normalized.migrations[0].id).toBe('test-id');
      expect(normalized.migrations[1].name).toBe('test-name');
      expect(normalized.migrations[2].version).toBe('2.0.0');
    });
  });

  describe('isMigrationData', () => {
    it('should return true for valid migration data', () => {
      const data: MigrationData = { migrations: [] };

      expect(isMigrationData(data)).toBe(true);
    });

    it('should return true for migration data with records', () => {
      const data = {
        migrations: [
          {
            id: 'test',
            name: 'Test',
            executedAt: new Date(),
            version: '1.0.0',
          },
        ],
      };

      expect(isMigrationData(data)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isMigrationData(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMigrationData(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isMigrationData('string')).toBe(false);
      expect(isMigrationData(123)).toBe(false);
      expect(isMigrationData(true)).toBe(false);
    });

    it('should return false for objects without migrations', () => {
      expect(isMigrationData({})).toBe(false);
      expect(isMigrationData({ other: 'field' })).toBe(false);
    });

    it('should return false when migrations is not an array', () => {
      expect(isMigrationData({ migrations: 'not-array' })).toBe(false);
      expect(isMigrationData({ migrations: null })).toBe(false);
      expect(isMigrationData({ migrations: {} })).toBe(false);
    });
  });
});

describe('Comment Configuration Contract', () => {
  describe('createDefaultCommentOtherConfig', () => {
    it('should create empty config', () => {
      const config = createDefaultCommentOtherConfig();

      expect(config).toEqual({});
      expect(Object.keys(config)).toHaveLength(0);
    });
  });

  describe('normalizeCommentOtherConfig', () => {
    it('should normalize valid config', () => {
      const raw = {
        serverURL: 'https://example.com',
        appId: 'test-app',
        appKey: 'test-key',
      };

      const normalized = normalizeCommentOtherConfig(raw);

      expect(normalized.serverURL).toBe('https://example.com');
      expect(normalized.appId).toBe('test-app');
      expect(normalized.appKey).toBe('test-key');
    });

    it('should handle null input', () => {
      const normalized = normalizeCommentOtherConfig(null);

      expect(normalized).toEqual({});
    });

    it('should handle undefined input', () => {
      const normalized = normalizeCommentOtherConfig(undefined);

      expect(normalized).toEqual({});
    });

    it('should handle non-object input', () => {
      expect(normalizeCommentOtherConfig('string')).toEqual({});
      expect(normalizeCommentOtherConfig(123)).toEqual({});
      expect(normalizeCommentOtherConfig(true)).toEqual({});
    });

    it('should convert all values to strings', () => {
      const raw = {
        number: 123,
        boolean: true,
        null: null,
        undefined,
        object: { nested: 'value' },
      };

      const normalized = normalizeCommentOtherConfig(raw);

      expect(normalized.number).toBe('123');
      expect(normalized.boolean).toBe('true');
      expect(normalized.null).toBe('null');
      expect(normalized.undefined).toBe('undefined');
      expect(normalized.object).toBe('[object Object]');
    });

    it('should handle empty object', () => {
      const normalized = normalizeCommentOtherConfig({});

      expect(normalized).toEqual({});
    });
  });
});

describe('Custom Code Contract', () => {
  describe('createDefaultCustomCode', () => {
    it('should create default custom code with empty strings', () => {
      const code = createDefaultCustomCode();

      expect(code).toEqual({
        css: '',
        script: '',
        html: '',
        head: '',
      });
    });
  });

  describe('normalizeCustomCode', () => {
    it('should normalize valid custom code', () => {
      const raw = {
        css: 'body { color: red; }',
        script: 'console.log("test");',
        html: '<div>Custom HTML</div>',
        head: '<meta name="test" />',
      };

      const normalized = normalizeCustomCode(raw);

      expect(normalized.css).toBe('body { color: red; }');
      expect(normalized.script).toBe('console.log("test");');
      expect(normalized.html).toBe('<div>Custom HTML</div>');
      expect(normalized.head).toBe('<meta name="test" />');
    });

    it('should handle null input', () => {
      const normalized = normalizeCustomCode(null);

      expect(normalized).toEqual(createDefaultCustomCode());
    });

    it('should handle undefined input', () => {
      const normalized = normalizeCustomCode(undefined);

      expect(normalized).toEqual(createDefaultCustomCode());
    });

    it('should handle non-object input', () => {
      expect(normalizeCustomCode('string')).toEqual(createDefaultCustomCode());
      expect(normalizeCustomCode(123)).toEqual(createDefaultCustomCode());
      expect(normalizeCustomCode(true)).toEqual(createDefaultCustomCode());
    });

    it('should handle partial custom code', () => {
      const raw = { css: 'body {}' };
      const normalized = normalizeCustomCode(raw);

      expect(normalized.css).toBe('body {}');
      expect(normalized.script).toBe('');
      expect(normalized.html).toBe('');
      expect(normalized.head).toBe('');
    });

    it('should convert non-string values to empty strings', () => {
      const raw = {
        css: 123,
        script: null,
        html: undefined,
        head: { nested: 'object' },
      };

      const normalized = normalizeCustomCode(raw);

      expect(normalized.css).toBe('');
      expect(normalized.script).toBe('');
      expect(normalized.html).toBe('');
      expect(normalized.head).toBe('');
    });

    it('should handle empty object', () => {
      const normalized = normalizeCustomCode({});

      expect(normalized).toEqual(createDefaultCustomCode());
    });
  });

  describe('isCustomCode', () => {
    it('should return true for valid custom code', () => {
      const code: CustomCode = {
        css: 'test',
        script: 'test',
        html: 'test',
        head: 'test',
      };

      expect(isCustomCode(code)).toBe(true);
    });

    it('should return true for partial custom code with undefined values', () => {
      expect(isCustomCode({ css: 'test' })).toBe(true);
      expect(isCustomCode({ script: 'test' })).toBe(true);
      expect(isCustomCode({})).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCustomCode(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCustomCode(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isCustomCode('string')).toBe(false);
      expect(isCustomCode(123)).toBe(false);
      expect(isCustomCode(true)).toBe(false);
    });

    it('should return false if any field is not a string (when defined)', () => {
      expect(isCustomCode({ css: 123 })).toBe(false);
      expect(isCustomCode({ script: null })).toBe(false);
      expect(isCustomCode({ html: true })).toBe(false);
      expect(isCustomCode({ head: {} })).toBe(false);
    });
  });
});

describe('Media Processing Config Contract', () => {
  describe('createDefaultMediaProcessingConfig', () => {
    it('should create default config', () => {
      const config = createDefaultMediaProcessingConfig();

      expect(config.compress).toEqual({
        enabled: false,
        quality: 80,
        format: 'webp',
      });
      expect(config.watermark).toEqual({
        enabled: false,
        text: '',
        position: 'bottom-right',
        opacity: 0.5,
      });
    });
  });

  describe('normalizeMediaProcessingConfig', () => {
    it('should normalize valid config', () => {
      const raw = {
        compress: {
          enabled: true,
          quality: 90,
          format: 'jpeg',
        },
        watermark: {
          enabled: true,
          text: 'Copyright',
          position: 'top-left',
          opacity: 0.8,
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.compress.enabled).toBe(true);
      expect(normalized.compress.quality).toBe(90);
      expect(normalized.compress.format).toBe('jpeg');
      expect(normalized.watermark.enabled).toBe(true);
      expect(normalized.watermark.text).toBe('Copyright');
      expect(normalized.watermark.position).toBe('top-left');
      expect(normalized.watermark.opacity).toBe(0.8);
    });

    it('should handle null input', () => {
      const normalized = normalizeMediaProcessingConfig(null);

      expect(normalized).toEqual(createDefaultMediaProcessingConfig());
    });

    it('should handle undefined input', () => {
      const normalized = normalizeMediaProcessingConfig(undefined);

      expect(normalized).toEqual(createDefaultMediaProcessingConfig());
    });

    it('should handle non-object input', () => {
      expect(normalizeMediaProcessingConfig('string')).toEqual(
        createDefaultMediaProcessingConfig(),
      );
      expect(normalizeMediaProcessingConfig(123)).toEqual(createDefaultMediaProcessingConfig());
      expect(normalizeMediaProcessingConfig(true)).toEqual(createDefaultMediaProcessingConfig());
    });

    it('should handle missing compress config', () => {
      const raw = {
        watermark: {
          enabled: true,
          text: 'Test',
          position: 'center',
          opacity: 0.5,
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.compress).toEqual(createDefaultMediaProcessingConfig().compress);
      expect(normalized.watermark.enabled).toBe(true);
    });

    it('should handle missing watermark config', () => {
      const raw = {
        compress: {
          enabled: true,
          quality: 85,
          format: 'png',
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.compress.enabled).toBe(true);
      expect(normalized.watermark).toEqual(createDefaultMediaProcessingConfig().watermark);
    });

    it('should reject invalid format values', () => {
      const raw = {
        compress: {
          enabled: true,
          quality: 80,
          format: 'invalid-format',
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.compress.format).toBe('webp'); // Default
    });

    it('should reject invalid watermark positions', () => {
      const raw = {
        watermark: {
          enabled: true,
          text: 'Test',
          position: 'invalid-position',
          opacity: 0.5,
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.watermark.position).toBe('bottom-right'); // Default
    });

    it('should handle partial compress config', () => {
      const raw = {
        compress: {
          enabled: true,
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.compress.enabled).toBe(true);
      expect(normalized.compress.quality).toBe(80); // Default
      expect(normalized.compress.format).toBe('webp'); // Default
    });

    it('should handle partial watermark config', () => {
      const raw = {
        watermark: {
          text: 'My Watermark',
        },
      };

      const normalized = normalizeMediaProcessingConfig(raw);

      expect(normalized.watermark.text).toBe('My Watermark');
      expect(normalized.watermark.enabled).toBe(false); // Default
      expect(normalized.watermark.position).toBe('bottom-right'); // Default
      expect(normalized.watermark.opacity).toBe(0.5); // Default
    });

    it('should handle all valid format values', () => {
      const formats: Array<'webp' | 'jpeg' | 'png'> = ['webp', 'jpeg', 'png'];

      formats.forEach((format) => {
        const raw = {
          compress: { enabled: true, quality: 80, format },
        };
        const normalized = normalizeMediaProcessingConfig(raw);
        expect(normalized.compress.format).toBe(format);
      });
    });

    it('should handle all valid position values', () => {
      const positions: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'> =
        ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

      positions.forEach((position) => {
        const raw = {
          watermark: { enabled: true, text: 'test', position, opacity: 0.5 },
        };
        const normalized = normalizeMediaProcessingConfig(raw);
        expect(normalized.watermark.position).toBe(position);
      });
    });
  });

  describe('isMediaProcessingConfig', () => {
    it('should return true for valid config', () => {
      const config = createDefaultMediaProcessingConfig();

      expect(isMediaProcessingConfig(config)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isMediaProcessingConfig(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isMediaProcessingConfig(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isMediaProcessingConfig('string')).toBe(false);
      expect(isMediaProcessingConfig(123)).toBe(false);
      expect(isMediaProcessingConfig(true)).toBe(false);
    });

    it('should return false when compress is missing', () => {
      expect(
        isMediaProcessingConfig({
          watermark: { enabled: false, text: '', position: 'center', opacity: 0.5 },
        }),
      ).toBe(false);
    });

    it('should return false when watermark is missing', () => {
      expect(
        isMediaProcessingConfig({
          compress: { enabled: false, quality: 80, format: 'webp' },
        }),
      ).toBe(false);
    });

    it('should return false when compress is null', () => {
      expect(
        isMediaProcessingConfig({
          compress: null,
          watermark: { enabled: false, text: '', position: 'center', opacity: 0.5 },
        }),
      ).toBe(false);
    });

    it('should return false when watermark is null', () => {
      expect(
        isMediaProcessingConfig({
          compress: { enabled: false, quality: 80, format: 'webp' },
          watermark: null,
        }),
      ).toBe(false);
    });
  });
});

describe('Media Processing Override Contract', () => {
  describe('createDefaultMediaProcessingOverride', () => {
    it('should create default override with empty objects', () => {
      const override = createDefaultMediaProcessingOverride();

      expect(override).toEqual({
        compress: {},
        watermark: {},
      });
    });
  });

  describe('normalizeMediaProcessingOverride', () => {
    it('should normalize valid override', () => {
      const raw = {
        compress: {
          enabled: true,
          quality: 95,
          maxWidth: 1920,
          maxHeight: 1080,
        },
        watermark: {
          enabled: true,
          text: 'Watermark',
          position: 'center',
          opacity: 0.7,
        },
      };

      const normalized = normalizeMediaProcessingOverride(raw);

      expect(normalized.compress).toBeDefined();
      expect(normalized.watermark).toBeDefined();
    });

    it('should handle null input', () => {
      const normalized = normalizeMediaProcessingOverride(null);

      expect(normalized).toEqual(createDefaultMediaProcessingOverride());
    });

    it('should handle undefined input', () => {
      const normalized = normalizeMediaProcessingOverride(undefined);

      expect(normalized).toEqual(createDefaultMediaProcessingOverride());
    });

    it('should handle non-object input', () => {
      expect(normalizeMediaProcessingOverride('string')).toEqual(
        createDefaultMediaProcessingOverride(),
      );
      expect(normalizeMediaProcessingOverride(123)).toEqual(createDefaultMediaProcessingOverride());
      expect(normalizeMediaProcessingOverride(true)).toEqual(
        createDefaultMediaProcessingOverride(),
      );
    });

    it('should handle missing compress', () => {
      const raw = {
        watermark: { enabled: true },
      };

      const normalized = normalizeMediaProcessingOverride(raw);

      expect(normalized.compress).toEqual({});
      expect(normalized.watermark).toBeDefined();
    });

    it('should handle missing watermark', () => {
      const raw = {
        compress: { enabled: true },
      };

      const normalized = normalizeMediaProcessingOverride(raw);

      expect(normalized.compress).toBeDefined();
      expect(normalized.watermark).toEqual({});
    });

    it('should handle null compress', () => {
      const raw = {
        compress: null,
        watermark: {},
      };

      const normalized = normalizeMediaProcessingOverride(raw);

      expect(normalized.compress).toEqual({});
    });

    it('should handle null watermark', () => {
      const raw = {
        compress: {},
        watermark: null,
      };

      const normalized = normalizeMediaProcessingOverride(raw);

      expect(normalized.watermark).toEqual({});
    });

    it('should handle empty object', () => {
      const normalized = normalizeMediaProcessingOverride({});

      expect(normalized).toEqual(createDefaultMediaProcessingOverride());
    });
  });
});

describe('Request Parameters Contract', () => {
  describe('createDefaultRequestParams', () => {
    it('should create empty params object', () => {
      const params = createDefaultRequestParams();

      expect(params).toEqual({});
      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe('createDefaultRequestQuery', () => {
    it('should create empty query object', () => {
      const query = createDefaultRequestQuery();

      expect(query).toEqual({});
      expect(Object.keys(query)).toHaveLength(0);
    });
  });

  describe('normalizeRequestParams', () => {
    it('should normalize valid params', () => {
      const raw = {
        id: '123',
        slug: 'test-article',
        category: 'tech',
      };

      const normalized = normalizeRequestParams(raw);

      expect(normalized.id).toBe('123');
      expect(normalized.slug).toBe('test-article');
      expect(normalized.category).toBe('tech');
    });

    it('should handle null input', () => {
      const normalized = normalizeRequestParams(null);

      expect(normalized).toEqual({});
    });

    it('should handle undefined input', () => {
      const normalized = normalizeRequestParams(undefined);

      expect(normalized).toEqual({});
    });

    it('should handle non-object input', () => {
      expect(normalizeRequestParams('string')).toEqual({});
      expect(normalizeRequestParams(123)).toEqual({});
      expect(normalizeRequestParams(true)).toEqual({});
    });

    it('should filter out non-string values', () => {
      const raw = {
        stringParam: 'value',
        numberParam: 123,
        boolParam: true,
        nullParam: null,
        undefinedParam: undefined,
        objectParam: { nested: 'value' },
        arrayParam: ['value'],
      };

      const normalized = normalizeRequestParams(raw);

      expect(normalized.stringParam).toBe('value');
      expect(normalized.numberParam).toBeUndefined();
      expect(normalized.boolParam).toBeUndefined();
      expect(normalized.nullParam).toBeUndefined();
      expect(normalized.undefinedParam).toBeUndefined();
      expect(normalized.objectParam).toBeUndefined();
      expect(normalized.arrayParam).toBeUndefined();
    });

    it('should handle empty object', () => {
      const normalized = normalizeRequestParams({});

      expect(normalized).toEqual({});
    });
  });

  describe('normalizeRequestQuery', () => {
    it('should normalize valid query with string values', () => {
      const raw = {
        search: 'test',
        page: '1',
        limit: '10',
      };

      const normalized = normalizeRequestQuery(raw);

      expect(normalized.search).toBe('test');
      expect(normalized.page).toBe('1');
      expect(normalized.limit).toBe('10');
    });

    it('should normalize valid query with array values', () => {
      const raw = {
        tags: ['typescript', 'nodejs'],
        categories: ['tech', 'programming'],
      };

      const normalized = normalizeRequestQuery(raw);

      expect(normalized.tags).toEqual(['typescript', 'nodejs']);
      expect(normalized.categories).toEqual(['tech', 'programming']);
    });

    it('should normalize mixed string and array values', () => {
      const raw = {
        search: 'test',
        tags: ['typescript', 'nodejs'],
        page: '1',
      };

      const normalized = normalizeRequestQuery(raw);

      expect(normalized.search).toBe('test');
      expect(normalized.tags).toEqual(['typescript', 'nodejs']);
      expect(normalized.page).toBe('1');
    });

    it('should handle null input', () => {
      const normalized = normalizeRequestQuery(null);

      expect(normalized).toEqual({});
    });

    it('should handle undefined input', () => {
      const normalized = normalizeRequestQuery(undefined);

      expect(normalized).toEqual({});
    });

    it('should handle non-object input', () => {
      expect(normalizeRequestQuery('string')).toEqual({});
      expect(normalizeRequestQuery(123)).toEqual({});
      expect(normalizeRequestQuery(true)).toEqual({});
    });

    it('should filter out invalid values', () => {
      const raw = {
        validString: 'value',
        validArray: ['one', 'two'],
        numberValue: 123,
        boolValue: true,
        nullValue: null,
        undefinedValue: undefined,
        objectValue: { nested: 'value' },
        mixedArray: ['one', 2, true],
      };

      const normalized = normalizeRequestQuery(raw);

      expect(normalized.validString).toBe('value');
      expect(normalized.validArray).toEqual(['one', 'two']);
      expect(normalized.numberValue).toBeUndefined();
      expect(normalized.boolValue).toBeUndefined();
      expect(normalized.nullValue).toBeUndefined();
      expect(normalized.undefinedValue).toBeUndefined();
      expect(normalized.objectValue).toBeUndefined();
      expect(normalized.mixedArray).toBeUndefined();
    });

    it('should handle empty object', () => {
      const normalized = normalizeRequestQuery({});

      expect(normalized).toEqual({});
    });

    it('should handle empty string arrays', () => {
      const raw = {
        tags: [],
      };

      const normalized = normalizeRequestQuery(raw);

      expect(normalized.tags).toEqual([]);
    });

    it('should handle arrays with empty strings', () => {
      const raw = {
        tags: ['', 'valid', ''],
      };

      const normalized = normalizeRequestQuery(raw);

      expect(normalized.tags).toEqual(['', 'valid', '']);
    });
  });
});
