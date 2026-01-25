/**
 * Beian Plugin
 *
 * 管理ICP备案信息，并将数据注入到 Bootstrap API
 */

import type { PluginAPI } from '@vanblog/shared/plugin';

interface BeianInfo {
  icp: string;
  policeIcp: string;
}

export default (api: PluginAPI) => {
  // 配置检查
  const enabled = api.config.enabled as boolean;
  if (!enabled) {
    api.log.warn('Beian plugin is disabled');
    return;
  }

  api.log.info('Beian plugin initializing...');

  // 存储备案信息
  const beianInfo = api.store<BeianInfo>('beianInfo', {
    icp: (api.config.icp as string) || 'ICP 12345678',
    policeIcp: (api.config.policeIcp as string) || '公网安备 12345678901234 号',
  });

  // 暴露备案信息给前端
  api.provide('beian', () => ({
    icp: beianInfo.value.icp,
    policeIcp: beianInfo.value.policeIcp,
  }));

  // 提供更新备案信息的方法
  api.action('beian|update', (data: BeianInfo) => {
    api.log.info('Updating beian info:', data);
    beianInfo.value = data;
  });

  // 生命周期
  api.onActivate(() => {
    api.log.info('Beian plugin activated');
    api.log.debug('Current beian info:', beianInfo.value);
  });

  api.onDeactivate(() => {
    api.log.info('Beian plugin deactivated');
  });

  // 配置变更监听
  api.onConfigChange('icp', (newValue) => {
    beianInfo.value.icp = newValue as string;
    api.log.info('ICP updated:', newValue);
  });

  api.onConfigChange('policeIcp', (newValue) => {
    beianInfo.value.policeIcp = newValue as string;
    api.log.info('Police ICP updated:', newValue);
  });

  api.log.info('Beian plugin initialized successfully');
};
