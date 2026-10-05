// Starlight 官方支持的自定义 content config 形态。
// 必须挂 docsSchema():Starlight 在 production 构建按 draft 字段过滤条目,
// 无 schema 时 frontmatter 没有 draft 默认值,全部页面会被静默丢弃。
// 内容由同目录 setup.sh 从上级 docs/ 用户层镜像到 src/content/docs/。
import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  i18n: defineCollection({ loader: i18nLoader() }),
};
