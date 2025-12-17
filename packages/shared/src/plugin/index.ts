/**
 * @file plugin/index.ts
 *
 * VanBlog 插件系统类型定义
 *
 * ## 设计原则
 *
 * 1. **package.json 声明** - 所有元数据、配置 schema 通过 package.json 的 vanblog 字段定义
 * 2. **函数式 API** - 插件入口为函数 `(api) => void`，无需复杂接口
 * 3. **前端边界清晰** - 仅通过 Bootstrap API 传递数据，前端主动渲染
 * 4. **渐进增强** - 向后兼容现有插件，新 API 可选采用
 *
 * ## 使用示例
 *
 * ### package.json
 * ```json
 * {
 *   "name": "cat-plugin",
 *   "version": "1.0.0",
 *   "main": "index.ts",
 *   "vanblog": {
 *     "displayName": "Cat Plugin",
 *     "config": {
 *       "enableTitle": { "type": "boolean", "default": true }
 *     }
 *   }
 * }
 * ```
 *
 * ### index.ts
 * ```typescript
 * import type { PluginAPI } from '@vanblog/shared/plugin';
 *
 * export default (api: PluginAPI) => {
 *   api.filter('article.beforeCreate', (article) => ({
 *     ...article,
 *     title: api.config.enableTitle ? article.title + '喵' : article.title,
 *   }));
 * };
 * ```
 */

export * from './manifest.js';
export * from './api.js';
