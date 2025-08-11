import { Injectable, Logger } from '@nestjs/common';
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import katex from 'markdown-it-katex';
import taskLists from 'markdown-it-task-lists';

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
    })
      .use(taskLists)
      .use(katex);
  }

  /**
   * 渲染 Markdown 为 HTML
   */
  renderMarkdown(content: string | null): string {
    if (!content || content === '') return '';
    return this.md.render(content);
  }

  /**
   * 获取文章描述（支持 <!-- more --> 分割符）
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
   * 移除 Markdown 标记，获取纯文本
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
   * 为 RSS 处理 Markdown 内容
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
