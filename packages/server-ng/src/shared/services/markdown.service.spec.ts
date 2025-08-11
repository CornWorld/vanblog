import { describe, it, expect, beforeEach } from 'vitest';

import { MarkdownService } from './markdown.service';

describe('MarkdownService', () => {
  let service: MarkdownService;

  beforeEach(() => {
    service = new MarkdownService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('renderMarkdown', () => {
    it('should render basic markdown', () => {
      const markdown = '# Hello\n\nThis is **bold** and *italic* text.';
      const result = service.renderMarkdown(markdown);

      expect(result).toContain('<h1>Hello</h1>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });

    it('should handle code blocks', () => {
      const markdown = '```javascript\nconsole.log("hello");\n```';
      const result = service.renderMarkdown(markdown);

      expect(result).toContain('<pre class="hljs"');
      expect(result).toContain('console');
      expect(result).toContain('log');
    });

    it('should handle mermaid diagrams', () => {
      const markdown = '```mermaid\ngraph TD\nA --> B\n```';
      const result = service.renderMarkdown(markdown);

      expect(result).toContain('<div class="mermaid">');
      expect(result).toContain('graph TD');
    });

    it('should handle task lists', () => {
      const markdown = '- [x] Completed task\n- [ ] Incomplete task';
      const result = service.renderMarkdown(markdown);

      expect(result).toContain('type="checkbox"');
      expect(result).toContain('checked=""');
    });

    it('should return empty string for empty input', () => {
      expect(service.renderMarkdown('')).toBe('');
      expect(service.renderMarkdown(null as any)).toBe('');
      expect(service.renderMarkdown(undefined as any)).toBe('');
    });
  });

  describe('getDescription', () => {
    it('should extract content before <!-- more --> marker', () => {
      const content = 'This is the summary.\n\n<!-- more -->\n\nThis is the full content.';
      const result = service.getDescription(content);

      expect(result).toBe('This is the summary.');
    });

    it('should strip markdown and truncate when no more marker', () => {
      const content = '# Title\n\nThis is **bold** text with [link](http://example.com).';
      const result = service.getDescription(content, 20);

      expect(result).toBe('Title This is bold t...');
    });

    it('should handle empty content', () => {
      expect(service.getDescription('')).toBe('');
      expect(service.getDescription(null as any)).toBe('');
    });

    it('should not truncate if content is shorter than maxLength', () => {
      const content = 'Short content';
      const result = service.getDescription(content, 100);

      expect(result).toBe('Short content');
    });
  });

  describe('stripMarkdown', () => {
    it('should remove all markdown formatting', () => {
      const markdown = `
# Heading

**Bold** and *italic* text.

[Link](http://example.com)

![Image](image.jpg)

> Quote

- List item
1. Numbered item

\`\`\`
code block
\`\`\`

\`inline code\`

---
      `;

      const result = service.stripMarkdown(markdown);

      expect(result).not.toContain('#');
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
      expect(result).not.toContain('[');
      expect(result).not.toContain('>');
      expect(result).not.toContain('`');
      expect(result).toContain('Heading');
      expect(result).toContain('Bold');
      expect(result).toContain('italic');
      expect(result).toContain('Link');
    });

    it('should handle empty content', () => {
      expect(service.stripMarkdown('')).toBe('');
      expect(service.stripMarkdown(null as any)).toBe('');
    });
  });

  describe('renderForRss', () => {
    it('should render markdown and handle mermaid for RSS', () => {
      const markdown = '# Title\n\n```mermaid\ngraph TD\nA --> B\n```';
      const result = service.renderForRss(markdown);

      expect(result).toContain('<h1>Title</h1>');
      expect(result).toContain('Mermaid 图表 RSS 暂无法显示');
      expect(result).toContain('background: #f3f3f3');
    });

    it('should handle empty content', () => {
      expect(service.renderForRss('')).toBe('');
      expect(service.renderForRss(null as any)).toBe('');
    });
  });
});
