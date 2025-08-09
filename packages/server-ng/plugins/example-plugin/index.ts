// Example plugin for VanBlog plugin system
// This demonstrates how to create a plugin with hooks and context usage

import dayjs from 'dayjs';
import type {
  ActionCallback,
  FilterCallback,
} from '../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/plugin-loader.service';

// Define types for article data
interface ArticleData {
  [key: string]: unknown;
  title: string;
  metadata?: {
    [key: string]: unknown;
    processedByPlugin?: string;
    processedAt?: string;
  };
}

interface Article {
  [key: string]: unknown;
  title: string;
}

const plugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'An example plugin demonstrating the VanBlog plugin system',

  // Plugin initialization
  async init(context: PluginContext): Promise<void> {
    context.logger.log('Example plugin initializing...');

    // Test data storage
    await context.data.set('initialized_at', dayjs().toISOString());
    await context.data.set('article_count', 0);

    // Test configuration reading
    const enableLogging = context.config.get('enable_logging', true) as boolean;
    const maxArticles = context.config.get('max_articles', 100) as number;

    context.logger.log(
      `Plugin config - Enable logging: ${String(enableLogging)}, Max articles: ${String(maxArticles)}`,
    );

    context.logger.log('Example plugin initialized successfully');
  },

  // Plugin cleanup
  async destroy(context: PluginContext): Promise<void> {
    context.logger.log('Example plugin destroying...');

    // Clean up any resources if needed
    const initTime = (await context.data.get('initialized_at')) as string | null;
    const articleCount = (await context.data.get('article_count')) as number | null;

    context.logger.log(
      `Plugin was active since ${String(initTime)}, processed ${String(articleCount)} articles`,
    );

    // Clear plugin data
    await context.data.clear();

    context.logger.log('Example plugin destroyed');
  },

  // Plugin hooks
  hooks: {
    beforeCreateArticle: {
      type: 'filter',
      priority: 10,
      handler: ((value: unknown, ...args: unknown[]) => {
        const articleData = value as ArticleData;
        const context = args[0] as PluginContext;
        context.logger.log('Processing article before creation:', String(articleData.title));

        // Example: Add a prefix to article title
        const prefix = context.config.get('title_prefix', '[Plugin]') as string;
        if (prefix && !articleData.title.startsWith(prefix)) {
          articleData.title = `${prefix} ${articleData.title}`;
        }

        // Example: Add plugin metadata
        articleData.metadata ??= {};
        articleData.metadata.processedByPlugin = 'example-plugin';
        articleData.metadata.processedAt = dayjs().toISOString();

        return articleData;
      }) as FilterCallback,
    },

    afterCreateArticle: {
      type: 'action',
      priority: 10,
      handler: (async (...args: unknown[]): Promise<void> => {
        const article = args[0] as Article;
        const context = args[1] as PluginContext;
        context.logger.log('Article created:', String(article.title));

        // Update article count
        const currentCount = ((await context.data.get('article_count')) as number | null) ?? 0;
        await context.data.set('article_count', currentCount + 1);

        // Example: Send notification or perform other actions
        const enableNotifications = context.config.get('enable_notifications', false) as boolean;
        if (enableNotifications) {
          context.logger.log(
            `Notification: New article "${String(article.title)}" has been created`,
          );
        }

        // Example: Log statistics
        const totalCount = currentCount + 1;
        if (totalCount % 10 === 0) {
          context.logger.log(
            `Milestone reached: ${String(totalCount)} articles processed by plugin`,
          );
        }
      }) as ActionCallback,
    },
  },
};

export default plugin;
