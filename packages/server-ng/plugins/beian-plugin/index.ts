import { Logger } from '@nestjs/common';

import { withPluginPrefix } from '../../src/modules/plugin/utils/prefix.util';

import { BeianService, type BeianInfo } from './beian.service';

import type {
  ActionCallback,
  FilterCallback,
} from '../../src/modules/plugin/interfaces/hook.interface';
import type { PluginContext } from '../../src/modules/plugin/interfaces/plugin-context.interface';
import type { Plugin } from '../../src/modules/plugin/services/plugin-loader.service';

const logger = new Logger(withPluginPrefix('beian-plugin'));
const beianService = new BeianService();

const plugin: Plugin = {
  id: 'beian-plugin',
  name: 'Beian Plugin',
  version: '1.0.0',
  description: 'Manage beian (ICP filing) information',

  async init(context: PluginContext): Promise<void> {
    logger.log('Beian plugin initializing...');

    // 初始化备案信息数据
    await context.data.set('beianInfo', {});

    logger.log('Beian plugin initialized successfully');
  },

  async destroy(_context: PluginContext): Promise<void> {
    logger.log('Beian plugin destroying...');
    // 清理逻辑（如果需要）
    logger.log('Beian plugin destroyed successfully');
  },

  async getBeianInfo(context: PluginContext): Promise<BeianInfo> {
    return beianService.getBeianInfo(context);
  },

  async updateBeianInfo(context: PluginContext, data: BeianInfo): Promise<BeianInfo> {
    return beianService.updateBeianInfo(context, data);
  },

  hooks: {
    'bootstrap|beforeGenerate': {
      type: 'action',
      priority: 10,
      handler: (async (_value: unknown, _context: PluginContext) => {
        logger.debug('Bootstrap before generate - beian');
      }) as ActionCallback,
    },

    'bootstrap|transformResponse': {
      type: 'filter',
      priority: 10,
      handler: (async (value: unknown, context: PluginContext) => {
        const beianInfo = await beianService.getBeianInfo(context);
        return {
          ...(value as Record<string, unknown>),
          beianInfo,
        };
      }) as FilterCallback,
    },
  },
};

export default plugin;
