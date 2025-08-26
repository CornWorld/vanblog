import { Logger } from '@nestjs/common';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

import { SocialLinksService, type SocialLink } from './social-links.service';

import type {
  ActionCallback,
  FilterCallback,
} from '../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/loader.service';

// 插件 Logger 实例
const logger = new Logger(withPluginPrefix('social-links-plugin'));

// 创建服务实例
const socialLinksService = new SocialLinksService();

const plugin: Plugin = {
  id: 'social-links-plugin',
  name: 'Social Links Plugin',
  version: '1.0.0',
  description: 'Manage social links configuration',

  // 暴露社交链接服务实例
  socialLinksService,

  async init(context: PluginContext): Promise<void> {
    logger.log('Social links plugin initializing...');

    // 初始化社交链接数据
    await context.data.set('socialLinks', []);

    logger.log('Social links plugin initialized successfully');
  },

  async destroy(context: PluginContext): Promise<void> {
    logger.log('Social links plugin destroying...');
    await context.data.clear();
    logger.log('Social links plugin destroyed');
  },

  // 提供便捷的 API 方法
  async getSocialLinks(context: PluginContext): Promise<SocialLink[]> {
    return socialLinksService.getSocialLinks(context);
  },

  async addOrUpdateSocialLink(
    context: PluginContext,
    data: { type: string; url: string },
  ): Promise<SocialLink[]> {
    return socialLinksService.addOrUpdateSocialLink(context, data);
  },

  async deleteSocialLink(context: PluginContext, type: string): Promise<SocialLink[]> {
    return socialLinksService.deleteSocialLink(context, type);
  },

  hooks: {
    'bootstrap|before_generate': {
      type: 'action',
      priority: 10,
      handler: ((_value: unknown, _context: PluginContext) => {
        logger.debug('Bootstrap before generate - social links');
      }) as ActionCallback,
    },

    'bootstrap|transform_response': {
      type: 'filter',
      priority: 10,
      handler: (async (value: unknown, context: PluginContext) => {
        if (value != null && typeof value === 'object') {
          const response = value as Record<string, unknown>;
          const socialLinks = await socialLinksService.getSocialLinks(context);
          response.socialLinks = socialLinks;
          logger.debug(`Added ${socialLinks.length} social links to bootstrap response`);
        }
        return value;
      }) as FilterCallback,
    },
  },
};

export default plugin;
