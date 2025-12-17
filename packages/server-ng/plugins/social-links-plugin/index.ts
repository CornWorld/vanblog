/**
 * Social Links Plugin
 *
 * 管理社交媒体链接（GitHub, Twitter, 微博等）
 */

import { z } from 'zod';

import type { PluginAPI } from '@vanblog/shared/plugin';

// 社交链接数据结构
const _SocialLinkSchema = z.object({
  type: z.string(), // 社交平台类型（如 "github", "twitter"）
  url: z.string().url(), // 链接地址
  icon: z.string().optional(), // 图标 URL（可选）
  label: z.string().optional(), // 显示文本（可选）
});

type SocialLink = z.infer<typeof _SocialLinkSchema>;

export default (api: PluginAPI) => {
  // 配置检查
  const enabled = api.config.enabled as boolean;
  if (!enabled) {
    api.log.warn('Social links plugin is disabled');
    return;
  }

  api.log.info('Social links plugin initializing...');

  // 存储社交链接
  const socialLinks = api.store<SocialLink[]>('socialLinks', []);

  // 暴露社交链接给前端
  api.provide('socialLinks', () => socialLinks.value);

  // Action: 添加或更新社交链接
  api.action('socialLinks|addOrUpdate', (data: SocialLink) => {
    const index = socialLinks.value.findIndex((link) => link.type === data.type);

    if (index >= 0) {
      // 更新现有链接
      socialLinks.value[index] = data;
      api.log.info(`Updated social link: ${data.type}`);
    } else {
      // 添加新链接
      socialLinks.value = [...socialLinks.value, data];
      api.log.info(`Added social link: ${data.type}`);
    }
  });

  // Action: 删除社交链接
  api.action('socialLinks|delete', (type: string) => {
    const initialLength = socialLinks.value.length;
    socialLinks.value = socialLinks.value.filter((link) => link.type !== type);

    if (socialLinks.value.length < initialLength) {
      api.log.info(`Deleted social link: ${type}`);
    } else {
      api.log.warn(`Social link not found: ${type}`);
    }
  });

  // 生命周期
  api.onActivate(() => {
    api.log.info('Social links plugin activated');
    api.log.debug(`Current social links count: ${socialLinks.value.length}`);
  });

  api.onDeactivate(() => {
    api.log.info('Social links plugin deactivated');
  });

  api.log.info('Social links plugin initialized successfully');
};
