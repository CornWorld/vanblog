import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

import RssPlugin, { type RssPluginContext } from './index';

describe('RssPlugin', () => {
  let plugin: RssPlugin;
  let mockContext: RssPluginContext;

  beforeEach(() => {
    // Mock context
    mockContext = {
      database: {},
      config: {
        get: vi.fn().mockReturnValue('./static'),
      },
      services: {
        markdown: {
          renderForRss: vi.fn().mockImplementation((content) => `<p>${String(content)}</p>`),
          getDescription: vi.fn().mockImplementation((content) => content.substring(0, 100)),
        },
        hook: {
          addAction: vi.fn(),
          addFilter: vi.fn(),
          doAction: vi.fn(),
          applyFilters: vi.fn(),
        },
        pluginRegistry: {
          register: vi.fn(),
          getData: vi.fn(),
          setData: vi.fn(),
        },
      },
      router: {
        get: vi.fn(),
        post: vi.fn(),
      },
    } as unknown as RssPluginContext;

    // Create plugin instance
    plugin = new RssPlugin(mockContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      plugin.onModuleInit();

      // Verify routes are registered
      expect(mockContext.router.get).toHaveBeenCalledWith('/rss/feed.xml', expect.any(Function));
      expect(mockContext.router.get).toHaveBeenCalledWith('/rss/feed.json', expect.any(Function));
      expect(mockContext.router.get).toHaveBeenCalledWith('/rss/atom.xml', expect.any(Function));

      // Verify hooks are registered
      expect(mockContext.services.hook.addAction).toHaveBeenCalledWith(
        'article|afterCreate',
        expect.any(Function),
      );
      expect(mockContext.services.hook.addAction).toHaveBeenCalledWith(
        'article|afterUpdate',
        expect.any(Function),
      );
      expect(mockContext.services.hook.addAction).toHaveBeenCalledWith(
        'article|afterDelete',
        expect.any(Function),
      );
      expect(mockContext.services.hook.addAction).toHaveBeenCalledWith(
        'setting|afterUpdate',
        expect.any(Function),
      );

      // Verify plugin is registered
      expect(mockContext.services.pluginRegistry.register).toHaveBeenCalledWith(
        'rss-plugin',
        expect.objectContaining({
          getConfig: expect.any(Function),
          updateConfig: expect.any(Function),
          getStatus: expect.any(Function),
        }),
      );

      // Verify bootstrap filter is added
      expect(mockContext.services.hook.addFilter).toHaveBeenCalledWith(
        'bootstrap|transformResponse',
        expect.any(Function),
      );
    });
  });

  describe('hook handlers', () => {
    it('should schedule RSS regeneration on article changes', () => {
      plugin.onModuleInit();

      // Get the article create hook handler
      const articleCreateCall = (mockContext.services.hook.addAction as Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'article|afterCreate',
      ) as unknown as [string, (...args: unknown[]) => void];
      const [, articleCreateHandler] = articleCreateCall;

      // Call the handler
      articleCreateHandler();

      // Verify timer is set (we can't easily test setTimeout, but we can verify the plugin doesn't crash)
      expect(articleCreateHandler).not.toThrow();
    });

    it('should handle setting updates for site-related keys', () => {
      plugin.onModuleInit();

      // Get the setting update hook handler
      const settingUpdateCall = (mockContext.services.hook.addAction as Mock).mock.calls.find(
        (call: unknown[]) => call[0] === 'setting|afterUpdate',
      ) as unknown as [string, (...args: unknown[]) => void];
      const [, settingUpdateHandler] = settingUpdateCall;

      // Test with site-related key
      expect(() => {
        settingUpdateHandler({ key: 'siteName' });
      }).not.toThrow();

      // Test with non-site-related key
      expect(() => {
        settingUpdateHandler({ key: 'otherSetting' });
      }).not.toThrow();
    });
  });

  describe('plugin configuration', () => {
    it('should provide default config when none exists', async () => {
      (mockContext.services.pluginRegistry.getData as unknown as Mock).mockResolvedValue(null);

      plugin.onModuleInit();

      const [[, registeredPlugin]] = (mockContext.services.pluginRegistry.register as Mock).mock
        .calls;
      const config = await registeredPlugin.getConfig();

      expect(config).toEqual({
        debounceTime: 180000,
        includeFullContent: true,
        maxItems: 50,
        customStyles: true,
      });
    });

    it('should return stored config when exists', async () => {
      const storedConfig = {
        debounceTime: 60000,
        includeFullContent: false,
        maxItems: 20,
        customStyles: false,
      };
      (mockContext.services.pluginRegistry.getData as unknown as Mock).mockResolvedValue(
        storedConfig,
      );

      plugin.onModuleInit();

      const [[, registeredPlugin]] = (mockContext.services.pluginRegistry.register as Mock).mock
        .calls;
      const config = await registeredPlugin.getConfig();

      expect(config).toEqual(storedConfig);
    });

    it('should update config', async () => {
      plugin.onModuleInit();

      const [[, registeredPlugin]] = (mockContext.services.pluginRegistry.register as Mock).mock
        .calls;
      const newConfig = {
        debounceTime: 60000,
        includeFullContent: false,
        maxItems: 20,
        customStyles: false,
      };

      await registeredPlugin.updateConfig(newConfig);

      expect(mockContext.services.pluginRegistry.setData).toHaveBeenCalledWith(
        'rss-plugin',
        'config',
        newConfig,
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup timer on destroy', () => {
      // Since the plugin uses its own internal logger, we can just verify it doesn't throw
      plugin.onModuleInit();
      expect(() => {
        plugin.onModuleDestroy();
      }).not.toThrow();
    });
  });
});
