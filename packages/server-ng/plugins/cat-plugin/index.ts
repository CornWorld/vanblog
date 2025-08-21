// 🐱插件：在文章保存时在内容/标题/标签的结尾添加"喵"

import { Logger } from '@nestjs/common';
import dayjs from 'dayjs';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

import type { FilterCallback } from '../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';

// 定义文章数据类型
interface ArticleData {
  [key: string]: unknown;
  title?: string;
  content?: string;
  tags?: string[];
}

// 插件 Logger 实例
const logger = new Logger(withPluginPrefix('cat-plugin'));

const plugin: Plugin = {
  id: 'cat-plugin',
  name: 'Cat Plugin',
  version: '1.0.0',
  description: '🐱插件：在文章保存时在内容/标题/标签的结尾添加喵',

  // 插件初始化
  async init(context: PluginContext): Promise<void> {
    logger.log(withPluginPrefix('cat-plugin', '插件正在初始化...'));

    // 记录插件初始化时间
    await context.data.set('initialized_at', dayjs().toISOString());
    await context.data.set('processed_articles', 0);

    // 读取配置
    const enableTitle = context.config.get('enable_title', true) as boolean;
    const enableContent = context.config.get('enable_content', true) as boolean;
    const enableTags = context.config.get('enable_tags', true) as boolean;

    logger.log(
      withPluginPrefix(
        'cat-plugin',
        `插件配置 - 标题: ${String(enableTitle)}, 内容: ${String(enableContent)}, 标签: ${String(enableTags)}`,
      ),
    );

    logger.log(withPluginPrefix('cat-plugin', '插件初始化成功'));
  },

  // 插件销毁
  async destroy(context: PluginContext): Promise<void> {
    logger.log(withPluginPrefix('cat-plugin', '插件正在销毁...'));

    const processedCount = await context.data.get('processed_articles');
    logger.log(withPluginPrefix('cat-plugin', `插件已处理 ${String(processedCount)} 篇文章`));

    // 清理数据
    await context.data.clear();

    logger.log(withPluginPrefix('cat-plugin', '插件销毁完成'));
  },

  // 钩子定义
  hooks: {
    // 文章创建前的过滤器
    'article|beforeCreate': {
      type: 'filter',
      priority: 10,
      handler: ((value: unknown, context: PluginContext) => {
        // 在断言之前做类型收窄
        if (typeof value !== 'object' || value === null) {
          return value;
        }

        const result: ArticleData = { ...(value as Record<string, unknown>) };

        // 读取配置
        const enableTitle = context.config.get('enable_title', true) as boolean;
        const enableContent = context.config.get('enable_content', true) as boolean;
        const enableTags = context.config.get('enable_tags', true) as boolean;

        // 处理标题
        if (enableTitle && typeof result.title === 'string' && !result.title.endsWith('喵')) {
          result.title = `${result.title}喵`;
        }

        // 处理内容
        if (enableContent && typeof result.content === 'string' && !result.content.endsWith('喵')) {
          result.content = `${result.content}喵`;
        }

        // 处理标签
        if (enableTags && Array.isArray(result.tags)) {
          result.tags = result.tags.map((tag) => {
            if (!tag.endsWith('喵')) {
              return `${tag}喵`;
            }
            return tag;
          });
        }

        logger.log(withPluginPrefix('cat-plugin', '已为文章添加喵~'));

        // 更新处理计数
        void context.data
          .get('processed_articles')
          .then(async (count) => {
            const newCount = (typeof count === 'number' ? count : 0) + 1;
            return context.data.set('processed_articles', newCount);
          })
          .catch(() => {
            // 忽略错误
          });

        return result;
      }) as FilterCallback,
    },

    // 文章更新前的过滤器
    'article|beforeUpdate': {
      type: 'filter',
      priority: 10,
      handler: ((value: unknown, context: PluginContext) => {
        // 在断言之前做类型收窄
        if (typeof value !== 'object' || value === null) {
          return value;
        }

        const result: ArticleData = { ...(value as Record<string, unknown>) };

        // 读取配置
        const enableTitle = context.config.get('enable_title', true) as boolean;
        const enableContent = context.config.get('enable_content', true) as boolean;
        const enableTags = context.config.get('enable_tags', true) as boolean;

        // 处理标题
        if (enableTitle && typeof result.title === 'string' && !result.title.endsWith('喵')) {
          result.title = `${result.title}喵`;
        }

        // 处理内容
        if (enableContent && typeof result.content === 'string' && !result.content.endsWith('喵')) {
          result.content = `${result.content}喵`;
        }

        // 处理标签
        if (enableTags && Array.isArray(result.tags)) {
          result.tags = result.tags.map((tag) => {
            if (!tag.endsWith('喵')) {
              return `${tag}喵`;
            }
            return tag;
          });
        }

        logger.log(withPluginPrefix('cat-plugin', '已为更新的文章添加喵~'));

        // 更新处理计数
        void context.data
          .get('processed_articles')
          .then(async (count) => {
            const newCount = (typeof count === 'number' ? count : 0) + 1;
            return context.data.set('processed_articles', newCount);
          })
          .catch(() => {
            // 忽略错误
          });

        return result;
      }) as FilterCallback,
    },
  },
};

export default plugin;
