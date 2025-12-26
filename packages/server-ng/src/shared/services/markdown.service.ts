import { Injectable, Logger } from '@nestjs/common';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import katex from 'markdown-it-katex';
import taskLists from 'markdown-it-task-lists';

/**
 * Markdown 处理服务
 *
 * 提供 Markdown 文本的渲染、解析和处理功能。支持代码高亮、数学公式、
 * 任务列表等扩展功能。用于将 Markdown 格式的文章内容转换为 HTML。
 */
@Injectable()
export class MarkdownService {
  private readonly logger = new Logger(MarkdownService.name);
  private readonly md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      breaks: true,
      linkify: false,
      highlight: (str, lang) => {
        if (lang === 'mermaid') {
          return `<div class="mermaid">${str}</div>`;
        }
        if (lang !== '' && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs" style="background: #f3f3f3; padding: 8px;"><code>${
              hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
            }</code></pre>`;
          } catch (error) {
            this.logger.warn(`Failed to highlight code with language ${lang}:`, error);
          }
        }
        return `<pre class="hljs" style="background: #f3f3f3; padding: 8px;"><code>${this.md.utils.escapeHtml(
          str,
        )}</code></pre>`;
      },
    });
    this.md.use(taskLists).use(katex);
  }

  /**
   * 渲染 Markdown 为 HTML
   *
   * 将 Markdown 格式的文本转换为 HTML，支持代码高亮、数学公式、
   * 任务列表等扩展功能。特别处理 Mermaid 图表和代码块的样式。
   *
   * @param content Markdown 格式的文本内容
   * @returns 转换后的 HTML 字符串
   */
  renderMarkdown(content: string | null): string {
    if (!content || content === '') return '';
    return this.md.render(content);
  }

  /**
   * 从 Markdown 内容中提取描述文本
   *
   * 移除 Markdown 语法标记，提取纯文本内容作为文章描述。
   * 自动截取指定长度，用于文章摘要显示。
   *
   * @param content Markdown 格式的文本内容
   * @param maxLength 最大长度，默认 200 字符
   * @returns 提取的描述文本
   */
  getDescription(content: string | null, maxLength = 200): string {
    if (!content || content === '') return '';

    // 首先检查是否有 <!-- more --> 分割符
    const moreSplit = content.split('<!-- more -->');
    if (moreSplit.length > 1) {
      return moreSplit[0].trim();
    }

    // 如果没有分割符，则提取纯文本并截断
    const plainText = this.stripMarkdown(content);
    return plainText.length > maxLength ? `${plainText.substring(0, maxLength)}...` : plainText;
  }

  /**
   * 移除 Markdown 语法标记
   *
   * 将 Markdown 文本转换为纯文本，移除所有格式化标记。
   * 用于搜索索引、描述提取等场景。
   *
   * @param content Markdown 格式的文本内容
   * @returns 移除标记后的纯文本
   */
  stripMarkdown(content: string | null): string {
    if (!content || content === '') return '';

    return (
      content
        // 移除代码块
        .replace(/```[\s\S]*?```/g, '')
        // 移除行内代码
        .replace(/`([^`]+)`/g, '$1')
        // 移除标题
        .replace(/#{1,6}\s+/g, '')
        // 移除粗体
        .replace(/\*\*(.*?)\*\*/g, '$1')
        // 移除斜体
        .replace(/\*(.*?)\*/g, '$1')
        // 移除链接
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // 移除图片
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // 移除引用
        .replace(/^>\s+/gm, '')
        // 移除列表标记
        .replace(/^[\s]*[-*+]\s+/gm, '')
        .replace(/^[\s]*\d+\.\s+/gm, '')
        // 移除水平线
        .replace(/^[-*_]{3,}$/gm, '')
        // 将多个换行转为单个空格
        .replace(/\n+/g, ' ')
        // 移除多余空格
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * 为 RSS 渲染 Markdown
   *
   * 专门为 RSS 订阅源渲染 Markdown 内容，移除可能影响 RSS 阅读器
   * 显示的特殊元素，如 Mermaid 图表等。
   *
   * @param content Markdown 格式的文本内容
   * @returns 适用于 RSS 的 HTML 字符串
   */
  renderForRss(content: string | null): string {
    if (!content || content === '') return '';

    const html = this.renderMarkdown(content);

    // 处理 Mermaid 图表在 RSS 中的显示
    return html.replace(
      /<div class="mermaid">/g,
      '<div class="mermaid" style="background: #f3f3f3; padding: 8px;"> <p>Mermaid 图表 RSS 暂无法显示，具体请查看原文</p>',
    );
  }
}
