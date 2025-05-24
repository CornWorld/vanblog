import * as yaml from 'yaml';
import * as path from 'path';
import * as fs from 'fs';
import { merge, get } from 'lodash-es';
// 解析配置文件
let rawConfigs = [];
if (process.env.VAN_BLOG_CONFIG_FILE) {
  rawConfigs = [path.resolve(process.env.VAN_BLOG_CONFIG_FILE)];
} else {
  rawConfigs = [path.resolve('/etc/van-blog/config.yaml'), path.resolve('./config.yaml')];
}

rawConfigs = rawConfigs
  .filter(Boolean)
  .filter(fs.existsSync)
  .map((file) => fs.readFileSync(file, 'utf-8'))
  .map((content) => yaml.parse(content));

if (rawConfigs.length === 0) {
  console.log('未检测到来自文件系统的`配置文件`(配置优先级：环境变量 > 配置文件 > 默认配置)');
  rawConfigs.push([]);
}

// 递归合并
// 优先级 env > config.{NODE_ENV}.yaml > config.yaml > /etc/authing/config.yaml > 默认值
const config = [...rawConfigs].reduce((prev, curr) => {
  return merge(prev, curr);
});

/**
 * 获得配置项的值
 * @param key 配置项的 key，可以通过 . 来选择子项，比如 app.port
 * @param defaultValue 默认值
 */
export const loadConfig = (key: string, defaultValue?: unknown) => {
  const envKey =
    'VAN_BLOG_' +
    key
      .split('.')
      .map((x) => x.toUpperCase())
      .join('_');

  if (typeof defaultValue !== 'function') {
    return process.env[envKey] || get(config, key, defaultValue);
  } else {
    return process.env[envKey] || get(config, key, false) || defaultValue();
  }
};
export const version = process.env['VAN_BLOG_VERSION'] || 'dev';
