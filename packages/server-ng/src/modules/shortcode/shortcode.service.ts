/**
 * @file shortcode.service.ts
 *
 * Shortcode 处理服务
 *
 * 实现类似 WordPress 的 shortcode 系统：
 * - `[tag /]` - 自闭合
 * - `[tag attr="value" /]` - 带属性的自闭合
 * - `[tag]content[/tag]` - 包含内容
 * - `[tag attr="value"]content[/tag]` - 带属性和内容
 *
 * ## 使用示例
 *
 * ```typescript
 * // 注册 shortcode
 * shortcodeService.register('gallery', (attrs, content, ctx) => {
 *   const { ids, columns = '3' } = attrs;
 *   return `<div class="gallery cols-${columns}">...</div>`;
 * });
 *
 * // 处理内容
 * const html = await shortcodeService.process(content, { postId: 1, postType: 'article' });
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';

import type { ShortcodeHandler, ShortcodeContext } from '@vanblog/shared/plugin';

/**
 * Shortcode 处理选项
 */
export interface ShortcodeProcessOptions {
  /** 文章/页面 ID */
  postId: number;
  /** 内容类型 */
  postType: 'article' | 'page' | 'draft';
  /** 是否忽略 HTML 标签内的 shortcode */
  ignoreHtml?: boolean;
}

/**
 * 已注册的 shortcode 信息
 */
interface RegisteredShortcode {
  tag: string;
  handler: ShortcodeHandler;
  pluginId: string;
}

@Injectable()
export class ShortcodeService {
  private readonly logger = new Logger(ShortcodeService.name);
  private readonly shortcodes = new Map<string, RegisteredShortcode>();

  /**
   * 注册 shortcode
   *
   * @param tag - Shortcode 标签名
   * @param handler - 处理函数
   * @param pluginId - 注册的插件 ID
   * @returns 取消注册函数
   */
  register(tag: string, handler: ShortcodeHandler, pluginId: string): () => void {
    // 验证标签名
    if (!tag || tag.trim() === '') {
      this.logger.warn('Invalid shortcode name: Empty name given');
      return () => {};
    }

    // 检查非法字符（类似 WordPress 的限制）

    if (/[<>&/[\]\u0000-\u0020=]/.test(tag)) {
      this.logger.warn(
        `Invalid shortcode name: ${tag}. Do not use spaces or reserved characters: & / < > [ ] =`,
      );
      return () => {};
    }

    // 检查是否已存在
    if (this.shortcodes.has(tag)) {
      const existing = this.shortcodes.get(tag);
      this.logger.warn(
        `Shortcode "${tag}" already registered by plugin "${existing?.pluginId}", overwriting with plugin "${pluginId}"`,
      );
    }

    this.shortcodes.set(tag, { tag, handler, pluginId });
    this.logger.debug(`Registered shortcode: [${tag}] by plugin "${pluginId}"`);

    return () => {
      if (this.shortcodes.get(tag)?.pluginId === pluginId) {
        this.shortcodes.delete(tag);
        this.logger.debug(`Unregistered shortcode: [${tag}]`);
      }
    };
  }

  /**
   * 移除 shortcode
   */
  unregister(tag: string): void {
    this.shortcodes.delete(tag);
  }

  /**
   * 检查 shortcode 是否已注册
   */
  exists(tag: string): boolean {
    return this.shortcodes.has(tag);
  }

  /**
   * 获取所有已注册的 shortcode 标签
   */
  getTags(): string[] {
    return Array.from(this.shortcodes.keys());
  }

  /**
   * 检查内容中是否包含指定的 shortcode
   */
  hasShortcode(content: string, tag: string): boolean {
    if (!content.includes('[')) {
      return false;
    }

    if (!this.exists(tag)) {
      return false;
    }

    const regex = this.getShortcodeRegex([tag]);
    return regex.test(content);
  }

  /**
   * 获取内容中的所有 shortcode 标签
   */
  getShortcodesInContent(content: string): string[] {
    if (!content.includes('[')) {
      return [];
    }

    // 快速匹配所有可能的标签

    const matches = content.match(/[([^<>&/[\]\u0000-\u0020=]+)/g) || [];
    const potentialTags = matches.map((m) => m.slice(1));

    // 过滤出已注册的标签并去重
    const uniqueTags = new Set<string>();
    for (const tag of potentialTags) {
      if (this.shortcodes.has(tag)) {
        uniqueTags.add(tag);
      }
    }

    return Array.from(uniqueTags);
  }

  /**
   * 处理内容中的所有 shortcode
   *
   * @param content - 待处理的内容
   * @param options - 处理选项
   * @returns 处理后的内容
   */
  async process(content: string, options: ShortcodeProcessOptions): Promise<string> {
    // 快速检查：没有方括号则直接返回
    if (!content.includes('[')) {
      return content;
    }

    // 没有注册的 shortcode 则直接返回
    if (this.shortcodes.size === 0) {
      return content;
    }

    // 查找内容中存在的已注册标签
    const tagnames = this.findTagsInContent(content);
    if (tagnames.length === 0) {
      return content;
    }

    const regex = this.getShortcodeRegex(tagnames);
    let result = content;
    let match: RegExpExecArray | null;

    // 使用临时数组收集替换
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    // 创建新的正则以避免状态问题
    const execRegex = new RegExp(regex.source, 'g');
    while ((match = execRegex.exec(content)) !== null) {
      const [fullMatch, escapeBefore, tag, attrs, selfClosing, innerContent, escapeAfter] = match;

      // 处理双括号转义 [[tag]] -> [tag]
      if (escapeBefore && escapeAfter) {
        replacements.push({
          start: match.index,
          end: match.index + fullMatch.length,
          replacement: fullMatch.slice(1, -1),
        });
        continue;
      }

      const shortcode = this.shortcodes.get(tag);
      if (!shortcode) {
        continue;
      }

      const parsedAttrs = this.parseAttributes(attrs || '');
      const ctx: ShortcodeContext = {
        postId: options.postId,
        postType: options.postType,
        pluginId: shortcode.pluginId,
      };

      try {
        const replacement = await shortcode.handler(
          parsedAttrs,
          selfClosing ? null : (innerContent ?? null),
          ctx,
        );

        replacements.push({
          start: match.index,
          end: match.index + fullMatch.length,
          replacement,
        });
      } catch (error) {
        this.logger.error(
          `Error processing shortcode [${tag}]: ${error instanceof Error ? error.message : String(error)}`,
        );
        // 出错时保留原文
      }
    }

    // 从后向前替换以保持索引正确
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { start, end, replacement } = replacements[i];
      result = result.slice(0, start) + replacement + result.slice(end);
    }

    return result;
  }

  /**
   * 移除内容中的所有 shortcode（只保留内容）
   */
  strip(content: string): string {
    if (!content.includes('[')) {
      return content;
    }

    const tagnames = this.findTagsInContent(content);
    if (tagnames.length === 0) {
      return content;
    }

    const regex = this.getShortcodeRegex(tagnames);
    return content.replace(
      regex,
      (match, escapeBefore, _tag, _attrs, _selfClosing, innerContent, escapeAfter) => {
        // 处理双括号转义
        if (escapeBefore && escapeAfter) {
          return match.slice(1, -1);
        }
        // 返回内部内容（如果有）
        return innerContent || '';
      },
    );
  }

  /**
   * 查找内容中存在的已注册标签
   */
  private findTagsInContent(content: string): string[] {
    // 快速预匹配所有可能的标签

    const matches = content.matchAll(/[([^<>&/[\]\u0000-\u0020=]+)/g);
    const potentialTags = new Set<string>();

    for (const match of matches) {
      if (this.shortcodes.has(match[1])) {
        potentialTags.add(match[1]);
      }
    }

    return Array.from(potentialTags);
  }

  /**
   * 构建 shortcode 匹配正则表达式
   *
   * 参考 WordPress get_shortcode_regex()
   *
   * 匹配组：
   * 1 - 转义用的前置 [
   * 2 - Shortcode 标签名
   * 3 - 属性字符串
   * 4 - 自闭合 /
   * 5 - 内容（如果有）
   * 6 - 转义用的后置 ]
   */
  private getShortcodeRegex(tagnames: string[]): RegExp {
    const tagPattern = tagnames.map((t) => this.escapeRegex(t)).join('|');

    // 构建正则表达式
    const pattern =
      '\\[' + // 开始方括号
      '(\\[?)' + // 1: 可选的第二个开始方括号（转义用）
      `(${tagPattern})` + // 2: Shortcode 标签名
      '(?![\\w-])' + // 标签名后不能是单词字符或连字符
      '(' + // 3: 属性部分
      '[^\\]\\/]*' + // 非 ] 或 / 的字符
      '(?:' +
      '\\/(?!\\])' + // / 后面不是 ]
      '[^\\]\\/]*' +
      ')*?' +
      ')' +
      '(?:' +
      '(\\/)' + // 4: 自闭合 /
      '\\]' + // 结束方括号
      '|' +
      '\\]' + // 结束方括号
      '(?:' +
      '(' + // 5: 内容
      '[^\\[]*' + // 非 [ 的内容
      '(?:' +
      '\\[(?!\\/\\2\\])' + // 不是闭合标签的 [
      '[^\\[]*' +
      ')*' +
      ')' +
      '\\[\\/\\2\\]' + // 闭合标签 [/tag]
      ')?' +
      ')' +
      '(\\]?)'; // 6: 可选的结束方括号（转义用）

    return new RegExp(pattern, 'g');
  }

  /**
   * 解析 shortcode 属性
   *
   * 支持的格式：
   * - `attr="value"` - 带引号的属性
   * - `attr='value'` - 单引号属性
   * - `attr=value` - 无引号属性
   * - `attr` - 布尔属性
   */
  private parseAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};

    if (!attrString || attrString.trim() === '') {
      return attrs;
    }

    // 匹配各种属性格式
    const attrRegex =
      /(\w+)\s*=\s*"([^"]*)"(?:\s|$)|(\w+)\s*=\s*'([^']*)'(?:\s|$)|(\w+)\s*=\s*(\S+)(?:\s|$)|(\w+)(?:\s|$)/g;

    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(attrString)) !== null) {
      if (match[1]) {
        // 双引号属性
        attrs[match[1]] = match[2];
      } else if (match[3]) {
        // 单引号属性
        attrs[match[3]] = match[4];
      } else if (match[5]) {
        // 无引号属性
        attrs[match[5]] = match[6];
      } else if (match[7]) {
        // 布尔属性
        attrs[match[7]] = 'true';
      }
    }

    return attrs;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
