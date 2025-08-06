// Example plugin for VanBlog plugin system
// This demonstrates how to create a plugin with hooks and context usage

import type {
  ActionCallback,
  FilterCallback,
} from '../../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../../src/modules/plugin/services/plugin-loader.service';

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
    await context.data.set('initialized_at', new Date().toISOString());
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
    const articleCount = (await context.data.get('article_count')) as number;
    context.logger.log(
      `Example plugin destroyed. Processed ${String(articleCount)} articles during its lifetime.`,
    );

    // Clean up stored data
    await context.data.delete('initialized_at');
    await context.data.delete('article_count');

    context.logger.log('Example plugin cleanup completed');
  },

  // Plugin hooks
  hooks: {
    'article:beforeCreate': {
      type: 'filter',
      priority: 10,
      handler: ((value: unknown, ...args: unknown[]) => {
        const articleData = value as ArticleData;
        const [context] = args as [PluginContext];

        context.logger.log(`Processing article: ${articleData.title}`);

        // Add metadata to indicate processing by this plugin
        articleData.metadata ??= {};
        articleData.metadata.processedByPlugin = 'example-plugin';
        articleData.metadata.processedAt = new Date().toISOString();

        context.logger.log('Article preprocessed by example plugin');

        return articleData;
      }) as FilterCallback,
    },

    'article:afterCreate': {
      type: 'action',
      priority: 10,
      handler: (async (...args: unknown[]): Promise<void> => {
        const [article, context] = args as [Article, PluginContext];

        context.logger.log(`Article created: ${article.title}`);

        // Update article count
        const currentCount = ((await context.data.get('article_count')) as number) || 0;
        await context.data.set('article_count', currentCount + 1);

        // Log statistics
        const initTime = (await context.data.get('initialized_at')) as string;
        context.logger.log(
          `Plugin statistics - Articles processed: ${String(currentCount + 1)}, Running since: ${initTime}`,
        );

        context.logger.log('Article post-processing completed by example plugin');
      }) as ActionCallback,
    },
  },
};

export default plugin;
