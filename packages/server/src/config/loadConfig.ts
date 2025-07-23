import * as yaml from 'yaml';
import * as path from 'path';
import * as fs from 'fs';
import { merge, get } from 'lodash-es';
// 解析配置文件
let rawConfigs: string[] = [];
if (process.env.VAN_BLOG_CONFIG_FILE) {
  rawConfigs = [path.resolve(process.env.VAN_BLOG_CONFIG_FILE)];
} else {
  rawConfigs = [
    path.resolve('/etc/van-blog/config.yaml'),
    path.resolve('./config.yaml'),
    path.resolve('./config.yml'),
  ];
}

rawConfigs = rawConfigs
  .filter(Boolean)
  .filter(fs.existsSync)
  .map((file) => fs.readFileSync(file, 'utf-8'))
  .map((content) => yaml.parse(content));

if (rawConfigs.length === 0) {
  console.log('未检测到来自文件系统的`配置文件`(配置优先级：环境变量 > 配置文件 > 默认配置)');
}

// 递归合并
// 优先级 env > config.{NODE_ENV}.yaml > config.yaml > /etc/authing/config.yaml > 默认值
const config = rawConfigs.reduce((prev, curr) => {
  return merge(prev, curr);
}, []);

/**
 * 获得配置项的值
 * @param key 配置项的 key，可以通过 . 来选择子项，比如 app.port
 * @param defaultValue 默认值
 */
export const loadConfig = <T = unknown>(key: string, defaultValue?: T | (() => T)): T => {
  const envKey =
    'VAN_BLOG_' +
    key
      .split('.')
      .map((x) => x.toUpperCase())
      .join('_');
  let ret: { t: string; val: T } = { t: '', val: defaultValue as T };
  if (process.env[envKey]) ret = { t: 'env', val: process.env[envKey] as T };
  else if (get(config, key)) ret = { t: 'cfg', val: get(config, key) as T };
  else if (typeof defaultValue === 'function')
    ret = { t: 'def_func', val: (defaultValue as () => T)() };
  else if (defaultValue !== undefined) ret = { t: 'def_val', val: defaultValue as T };
  else ret = { t: 'not found', val: undefined as T };

  console.log('load config', { key, ...ret }); // TODO DEBUG

  return ret.val;
};

export const version = process.env['VAN_BLOG_VERSION'] || 'dev';
