/**
 * Data Contracts for VanBlog Server-NG
 *
 * This file defines strict TypeScript interfaces and default value strategies
 * to eliminate defensive programming patterns and "as any" type assertions.
 *
 * Philosophy: "Good taste eliminates special cases"
 * - Linus Torvalds
 */

// ============================================================================
// Migration Data Contract
// ============================================================================

export interface MigrationRecord {
  readonly id: string;
  readonly name: string;
  readonly executedAt: Date;
  readonly version: string;
}

export interface MigrationData {
  readonly migrations: readonly MigrationRecord[];
}

export const createDefaultMigrationData = (): MigrationData => ({
  migrations: [],
});

export const normalizeMigrationData = (raw: unknown): MigrationData => {
  if (typeof raw !== 'object' || raw === null) {
    return createDefaultMigrationData();
  }

  const data = raw as Record<string, unknown>;
  const migrations = Array.isArray(data.migrations) ? data.migrations : [];

  return {
    migrations: migrations.map(normalizeMigrationRecord),
  };
};

const normalizeMigrationRecord = (raw: unknown): MigrationRecord => {
  if (typeof raw !== 'object' || raw === null) {
    return {
      id: '',
      name: '',
      executedAt: new Date(),
      version: '0.0.0',
    };
  }

  const record = raw as Record<string, unknown>;
  return {
    id: typeof record.id === 'string' ? record.id : '',
    name: typeof record.name === 'string' ? record.name : '',
    executedAt: record.executedAt instanceof Date ? record.executedAt : new Date(),
    version: typeof record.version === 'string' ? record.version : '0.0.0',
  };
};

// ============================================================================
// Comment Configuration Contract
// ============================================================================

export interface CommentOtherConfig {
  readonly [key: string]: string;
}

export const createDefaultCommentOtherConfig = (): CommentOtherConfig => ({});

export const normalizeCommentOtherConfig = (raw: unknown): CommentOtherConfig => {
  if (typeof raw !== 'object' || raw === null) {
    return createDefaultCommentOtherConfig();
  }

  const config: Record<string, string> = {};
  const data = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(data)) {
    config[key] = String(value);
  }

  return config;
};

// ============================================================================
// Custom Code Contract
// ============================================================================

export interface CustomCode {
  readonly css?: string;
  readonly script?: string;
  readonly html?: string;
  readonly head?: string;
}

export const createDefaultCustomCode = (): CustomCode => ({
  css: '',
  script: '',
  html: '',
  head: '',
});

export const normalizeCustomCode = (raw: unknown): CustomCode => {
  if (typeof raw !== 'object' || raw === null) {
    return createDefaultCustomCode();
  }

  const data = raw as Record<string, unknown>;
  return {
    css: typeof data.css === 'string' ? data.css : '',
    script: typeof data.script === 'string' ? data.script : '',
    html: typeof data.html === 'string' ? data.html : '',
    head: typeof data.head === 'string' ? data.head : '',
  };
};

// ============================================================================
// Media Processing Configuration Contract
// ============================================================================

export interface MediaProcessingConfig {
  readonly compress: {
    readonly enabled: boolean;
    readonly quality: number;
    readonly format: 'webp' | 'jpeg' | 'png';
  };
  readonly watermark: {
    readonly enabled: boolean;
    readonly text: string;
    readonly position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    readonly opacity: number;
  };
}

export const createDefaultMediaProcessingConfig = (): MediaProcessingConfig => ({
  compress: {
    enabled: false,
    quality: 80,
    format: 'webp',
  },
  watermark: {
    enabled: false,
    text: '',
    position: 'bottom-right',
    opacity: 0.5,
  },
});

export const normalizeMediaProcessingConfig = (raw: unknown): MediaProcessingConfig => {
  if (typeof raw !== 'object' || raw === null) {
    return createDefaultMediaProcessingConfig();
  }

  const data = raw as Record<string, unknown>;
  const defaultConfig = createDefaultMediaProcessingConfig();

  return {
    compress: normalizeCompressConfig(data.compress, defaultConfig.compress),
    watermark: normalizeWatermarkConfig(data.watermark, defaultConfig.watermark),
  };
};

const normalizeCompressConfig = (
  raw: unknown,
  defaultConfig: MediaProcessingConfig['compress'],
): MediaProcessingConfig['compress'] => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultConfig;
  }

  const data = raw as Record<string, unknown>;
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaultConfig.enabled,
    quality: typeof data.quality === 'number' ? data.quality : defaultConfig.quality,
    format: ['webp', 'jpeg', 'png'].includes(data.format as string)
      ? (data.format as 'webp' | 'jpeg' | 'png')
      : defaultConfig.format,
  };
};

const normalizeWatermarkConfig = (
  raw: unknown,
  defaultConfig: MediaProcessingConfig['watermark'],
): MediaProcessingConfig['watermark'] => {
  if (typeof raw !== 'object' || raw === null) {
    return defaultConfig;
  }

  const data = raw as Record<string, unknown>;
  const validPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaultConfig.enabled,
    text: typeof data.text === 'string' ? data.text : defaultConfig.text,
    position: validPositions.includes(data.position as string)
      ? (data.position as MediaProcessingConfig['watermark']['position'])
      : defaultConfig.position,
    opacity: typeof data.opacity === 'number' ? data.opacity : defaultConfig.opacity,
  };
};

// ============================================================================
// Request Parameters Contract
// ============================================================================

export interface RequestParams {
  readonly [key: string]: string | undefined;
}

export interface RequestQuery {
  readonly [key: string]: string | string[] | undefined;
}

export const createDefaultRequestParams = (): RequestParams => ({});
export const createDefaultRequestQuery = (): RequestQuery => ({});

export const normalizeRequestParams = (raw: unknown): RequestParams => {
  if (typeof raw !== 'object' || raw === null) {
    return createDefaultRequestParams();
  }

  const params: Record<string, string | undefined> = {};
  const data = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      params[key] = value;
    }
  }

  return params;
};

export const normalizeRequestQuery = (raw: unknown): RequestQuery => {
  if (typeof raw !== 'object' || raw === null) {
    return createDefaultRequestQuery();
  }

  const query: Record<string, string | string[] | undefined> = {};
  const data = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      query[key] = value;
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      query[key] = value;
    }
  }

  return query;
};

// ============================================================================
// Type Guards - Runtime Type Safety
// ============================================================================

export const isMigrationData = (obj: unknown): obj is MigrationData => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'migrations' in obj &&
    Array.isArray((obj as MigrationData).migrations)
  );
};

export const isCustomCode = (obj: unknown): obj is CustomCode => {
  if (typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return (
    (data.css === undefined || typeof data.css === 'string') &&
    (data.script === undefined || typeof data.script === 'string') &&
    (data.html === undefined || typeof data.html === 'string') &&
    (data.head === undefined || typeof data.head === 'string')
  );
};

export const isMediaProcessingConfig = (obj: unknown): obj is MediaProcessingConfig => {
  if (typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.compress === 'object' &&
    data.compress !== null &&
    typeof data.watermark === 'object' &&
    data.watermark !== null
  );
};

// ============================================================================
// Media Processing Override Contract
// ============================================================================

export interface MediaProcessingOverride {
  compress?: {
    enabled?: boolean;
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
  watermark?: {
    enabled?: boolean;
    text?: string;
    position?: 'center' | 'northwest' | 'northeast' | 'southwest' | 'southeast';
    opacity?: number;
  };
}

export function createDefaultMediaProcessingOverride(): MediaProcessingOverride {
  return {
    compress: {},
    watermark: {},
  };
}

export function normalizeMediaProcessingOverride(data: unknown): MediaProcessingOverride {
  if (data == null) {
    return createDefaultMediaProcessingOverride();
  }

  if (typeof data !== 'object') {
    return createDefaultMediaProcessingOverride();
  }

  const obj = data as Record<string, unknown>;
  return {
    compress:
      typeof obj.compress === 'object' && obj.compress != null
        ? (obj.compress as Record<string, unknown>)
        : {},
    watermark:
      typeof obj.watermark === 'object' && obj.watermark != null
        ? (obj.watermark as Record<string, unknown>)
        : {},
  };
}
