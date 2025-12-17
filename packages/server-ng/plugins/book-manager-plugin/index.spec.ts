import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PluginAPI } from '@vanblog/shared/plugin';

import plugin from './index';

describe('Book Manager Plugin (Functional API)', () => {
  let mockAPI: Partial<PluginAPI>;
  let storeValues: Map<string, any>;
  let mockDbData: any[];

  beforeEach(() => {
    storeValues = new Map();
    mockDbData = [];

    mockAPI = {
      id: 'book-manager-plugin',
      version: '1.0.0',
      dir: '/path/to/plugin',
      config: {
        enabled: true,
        maxBooksPerAuthor: 10,
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn((cb) => cb(mockDbData)),
                catch: vi.fn(),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          }),
        }),
      } as any,
      table: vi.fn().mockReturnValue({ name: 'books' }),
      coreTable: vi.fn().mockReturnValue({
        name: 'articles',
        createdAt: { desc: vi.fn() },
      }),
      inject: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('sqlite://test.db'),
      }),
      filter: vi.fn(),
      action: vi.fn(),
      shortcode: vi.fn(),
      provide: vi.fn(),
      exposeAPI: vi.fn(),
      store: vi.fn((key: string, defaultValue: any) => ({
        get value() {
          return storeValues.has(key) ? storeValues.get(key) : defaultValue;
        },
        set value(newValue: any) {
          storeValues.set(key, newValue);
        },
      })),
      onActivate: vi.fn(),
      onDeactivate: vi.fn(),
      onConfigChange: vi.fn(),
    };
  });

  it('should load plugin successfully when enabled', () => {
    expect(() => {
      plugin(mockAPI as PluginAPI);
    }).not.toThrow();
    expect(mockAPI.log?.info).toHaveBeenCalledWith(
      'Book Manager Plugin v2.0 initializing...',
    );
    expect(mockAPI.log?.info).toHaveBeenCalledWith(
      'Book Manager Plugin v2.0 initialized successfully! 🎉',
    );
  });

  it('should not initialize when disabled', () => {
    mockAPI.config = { enabled: false, maxBooksPerAuthor: 10 };

    plugin(mockAPI as PluginAPI);

    expect(mockAPI.log?.warn).toHaveBeenCalledWith('Plugin is disabled');
    expect(mockAPI.table).not.toHaveBeenCalled();
  });

  it('should create book table', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.table).toHaveBeenCalledWith('books', expect.any(Object));
    expect(mockAPI.log?.info).toHaveBeenCalledWith(
      'Book table created/loaded successfully',
    );
  });

  it('should register filter hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.filter).toHaveBeenCalledWith(
      'article.beforeCreate',
      expect.any(Function),
    );
  });

  it('should register action hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.action).toHaveBeenCalledWith(
      'article.afterCreate',
      expect.any(Function),
    );
  });

  it('should register shortcode', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.shortcode).toHaveBeenCalledWith(
      'book',
      expect.any(Function),
    );
  });

  it('should register lifecycle hooks', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onActivate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockAPI.onDeactivate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should register config change listener', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.onConfigChange).toHaveBeenCalledWith(
      'maxBooksPerAuthor',
      expect.any(Function),
    );
  });

  it('should expose Book API', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.exposeAPI).toHaveBeenCalledWith('book', expect.any(Object));
  });

  it('should provide book stats', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.provide).toHaveBeenCalledWith(
      'bookStats',
      expect.any(Function),
    );
  });

  it('should inject ConfigService', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.inject).toHaveBeenCalled();
  });

  it('should access core articles table', () => {
    plugin(mockAPI as PluginAPI);

    expect(mockAPI.coreTable).toHaveBeenCalledWith('articles');
  });

  describe('Filter: article.beforeCreate', () => {
    it('should add book-review tag when article contains book references', async () => {
      let filterHandler: any;
      mockAPI.filter = vi.fn((hookName, handler) => {
        if (hookName === 'article.beforeCreate') {
          filterHandler = handler;
        }
      }) as any;

      plugin(mockAPI as PluginAPI);

      const article = {
        title: 'My Book Review',
        content: 'Check out [book:978-0-123456-78-9] for more info',
        tags: ['review'],
      };

      const result = await filterHandler(article);

      expect(result.tags).toContain('book-review');
    });

    it('should not modify article without book references', async () => {
      let filterHandler: any;
      mockAPI.filter = vi.fn((hookName, handler) => {
        if (hookName === 'article.beforeCreate') {
          filterHandler = handler;
        }
      }) as any;

      plugin(mockAPI as PluginAPI);

      const article = {
        title: 'Regular Article',
        content: 'No book references here',
        tags: ['general'],
      };

      const result = await filterHandler(article);

      expect(result.tags).not.toContain('book-review');
    });
  });

  describe('Shortcode: [book]', () => {
    it('should return error for missing ISBN', async () => {
      let shortcodeHandler: any;
      mockAPI.shortcode = vi.fn((name, handler) => {
        if (name === 'book') {
          shortcodeHandler = handler;
        }
      });

      plugin(mockAPI as PluginAPI);

      const result = await shortcodeHandler({});

      expect(result).toContain('Error: Missing ISBN or ID');
    });

    it('should return error when book not found', async () => {
      let shortcodeHandler: any;
      mockAPI.shortcode = vi.fn((name, handler) => {
        if (name === 'book') {
          shortcodeHandler = handler;
        }
      });

      // Mock empty db result
      mockAPI.db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockResolvedValue([]),
        }),
      } as any;

      plugin(mockAPI as PluginAPI);

      const result = await shortcodeHandler({ isbn: '978-0-123456-78-9' });

      expect(result).toContain('Book not found');
    });
  });

  describe('Exposed Book API', () => {
    it('should expose search, getByAuthor, addBook, getRecommendations methods', () => {
      let exposedAPI: any;
      mockAPI.exposeAPI = vi.fn((name, api) => {
        if (name === 'book') {
          exposedAPI = api;
        }
      });

      plugin(mockAPI as PluginAPI);

      expect(exposedAPI).toHaveProperty('search');
      expect(exposedAPI).toHaveProperty('getByAuthor');
      expect(exposedAPI).toHaveProperty('addBook');
      expect(exposedAPI).toHaveProperty('getRecommendations');
    });
  });

  describe('Store: stats', () => {
    it('should initialize stats store with default values', () => {
      plugin(mockAPI as PluginAPI);

      expect(mockAPI.store).toHaveBeenCalledWith('stats', {
        totalBooks: 0,
        totalAuthors: 0,
        lastUpdate: expect.any(String),
      });
    });
  });

  it('should handle table creation failure gracefully', () => {
    mockAPI.table = vi.fn().mockImplementation(() => {
      throw new Error('Table creation failed');
    });

    plugin(mockAPI as PluginAPI);

    expect(mockAPI.log?.error).toHaveBeenCalledWith(
      'Failed to create book table',
      expect.any(Error),
    );
    // Should not register hooks after failure
    expect(mockAPI.filter).not.toHaveBeenCalled();
  });

  it('should handle ConfigService injection failure gracefully', () => {
    mockAPI.inject = vi.fn().mockImplementation(() => {
      throw new Error('Injection failed');
    });

    expect(() => {
      plugin(mockAPI as PluginAPI);
    }).not.toThrow();

    expect(mockAPI.log?.warn).toHaveBeenCalledWith(
      'Failed to inject ConfigService',
      expect.any(Error),
    );
  });
});
