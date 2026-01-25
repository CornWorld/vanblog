/**
 * Cat Plugin - 新版函数式 API 示例
 *
 * 🐱插件：在文章保存时在内容/标题/标签的结尾添加"喵"
 *
 * 这是使用新的简化 PluginAPI 的示例实现。
 * 对比旧版本（index.old.ts），代码量减少约 70%。
 *
 * ## 功能演示
 * - Filter hooks：文章创建/更新前处理
 * - 响应式存储：自动持久化计数器
 * - Shortcode：在内容中嵌入猫咪表情
 */

import type { PluginAPI } from '@vanblog/shared/plugin';

// 定义文章数据类型
interface ArticleData {
  [key: string]: unknown;
  title?: string;
  content?: string;
  tags?: string[];
}

/**
 * 处理文章数据，添加"喵"
 */
function processArticle(article: ArticleData, config: Record<string, unknown>): ArticleData {
  const result = { ...article };

  const enableTitle = config.enableTitle !== false;
  const enableContent = config.enableContent !== false;
  const enableTags = config.enableTags !== false;

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
    result.tags = result.tags.map((tag) => (tag.endsWith('喵') ? tag : `${tag}喵`));
  }

  return result;
}

// 猫咪表情库
const CAT_EMOJIS: Record<string, string> = {
  happy: '😺',
  grin: '😸',
  joy: '😹',
  love: '😻',
  smirk: '😼',
  kiss: '😽',
  scared: '🙀',
  cry: '😿',
  angry: '😾',
  default: '🐱',
};

/**
 * 插件入口函数
 *
 * 新版 API 只需要导出一个函数，接收 PluginAPI 实例
 */
export default function catPlugin(api: PluginAPI): void {
  // 响应式存储：处理计数（自动持久化）
  const processedCount = api.store('processedCount', 0);
  const shortcodeCount = api.store('shortcodeCount', 0);

  // 注册 filter：文章创建前
  api.filter<ArticleData>('article.beforeCreate', (article) => {
    const result = processArticle(article, api.config);
    processedCount.value++;
    api.log.info('已为新文章添加喵~');
    return result;
  });

  // 注册 filter：文章更新前
  api.filter<ArticleData>('article.beforeUpdate', (article) => {
    const result = processArticle(article, api.config);
    processedCount.value++;
    api.log.info('已为更新的文章添加喵~');
    return result;
  });

  // 注册 shortcode: [cat] 或 [cat mood="happy"]
  // 使用示例：
  //   [cat /] -> 🐱
  //   [cat mood="happy" /] -> 😺
  //   [cat mood="love"]喵喵[/cat] -> 😻喵喵😻
  api.shortcode('cat', (attrs, content) => {
    const mood = attrs.mood || 'default';
    const emoji = CAT_EMOJIS[mood] || CAT_EMOJIS.default;

    shortcodeCount.value++;

    if (content) {
      // 有内容时，用表情包裹内容
      return `${emoji}${content}${emoji}`;
    }

    // 无内容时，只返回表情
    return emoji;
  });

  // 生命周期：激活时
  api.onActivate(() => {
    api.log.info('Cat Plugin 已激活 🐱');
    api.log.info(
      `配置: enableTitle=${String(api.config.enableTitle)}, enableContent=${String(api.config.enableContent)}, enableTags=${String(api.config.enableTags)}`,
    );
  });

  // 生命周期：停用时
  api.onDeactivate(() => {
    api.log.info(
      `Cat Plugin 停用，共处理 ${String(processedCount.value)} 篇文章，${String(shortcodeCount.value)} 次 shortcode`,
    );
  });

  api.log.info('Cat Plugin 加载成功');
}
