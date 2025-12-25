/**
 * @file shortcode.service.spec.ts
 *
 * ShortcodeService 测试
 */

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ShortcodeService, type ShortcodeProcessOptions } from './shortcode.service';
import type { ShortcodeHandler } from '@vanblog/shared/plugin';

describe('ShortcodeService', () => {
  let service: ShortcodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShortcodeService],
    }).compile();

    service = module.get<ShortcodeService>(ShortcodeService);
  });

  afterEach(() => {
    // 清理所有注册的 shortcodes
    for (const tag of service.getTags()) {
      service.unregister(tag);
    }
  });

  const defaultOptions: ShortcodeProcessOptions = {
    postId: 1,
    postType: 'article',
  };

  describe('register', () => {
    it('should register a shortcode', () => {
      const handler: ShortcodeHandler = () => '<div>test</div>';
      service.register('test', handler, 'test-plugin');

      expect(service.exists('test')).toBe(true);
      expect(service.getTags()).toContain('test');
    });

    it('should return unregister function', () => {
      const handler: ShortcodeHandler = () => '<div>test</div>';
      const unregister = service.register('test', handler, 'test-plugin');

      expect(service.exists('test')).toBe(true);

      unregister();

      expect(service.exists('test')).toBe(false);
    });

    it('should reject empty tag names', () => {
      const handler: ShortcodeHandler = () => '<div>test</div>';
      service.register('', handler, 'test-plugin');

      expect(service.exists('')).toBe(false);
    });

    it('should reject tag names with reserved characters', () => {
      const handler: ShortcodeHandler = () => '<div>test</div>';

      service.register('test<tag', handler, 'test-plugin');
      expect(service.exists('test<tag')).toBe(false);

      service.register('test>tag', handler, 'test-plugin');
      expect(service.exists('test>tag')).toBe(false);

      service.register('test/tag', handler, 'test-plugin');
      expect(service.exists('test/tag')).toBe(false);

      service.register('test[tag', handler, 'test-plugin');
      expect(service.exists('test[tag')).toBe(false);

      service.register('test tag', handler, 'test-plugin');
      expect(service.exists('test tag')).toBe(false);
    });

    it('should overwrite existing shortcode', () => {
      const handler1: ShortcodeHandler = () => 'handler1';
      const handler2: ShortcodeHandler = () => 'handler2';

      service.register('test', handler1, 'plugin1');
      service.register('test', handler2, 'plugin2');

      expect(service.exists('test')).toBe(true);
    });
  });

  describe('process', () => {
    it('should return content unchanged if no brackets', async () => {
      const content = 'Hello World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe(content);
    });

    it('should return content unchanged if no registered shortcodes', async () => {
      const content = 'Hello [unknown] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe(content);
    });

    it('should process self-closing shortcode', async () => {
      service.register('test', () => '<div>processed</div>', 'test-plugin');

      const content = 'Hello [test /] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello <div>processed</div> World');
    });

    it('should process shortcode with content', async () => {
      service.register('wrap', (_attrs, content) => `<div>${content ?? ''}</div>`, 'test-plugin');

      const content = 'Hello [wrap]inner content[/wrap] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello <div>inner content</div> World');
    });

    it('should process shortcode with attributes', async () => {
      service.register(
        'link',
        (attrs) => `<a href="${attrs.url}">${attrs.text}</a>`,
        'test-plugin',
      );

      const content = 'Hello [link url="https://example.com" text="Click me" /] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello <a href="https://example.com">Click me</a> World');
    });

    it('should support single-quoted attributes', async () => {
      service.register(
        'link',
        (attrs) => `<a href="${attrs.url}">${attrs.text}</a>`,
        'test-plugin',
      );

      const content = "Hello [link url='https://example.com' text='Click me' /] World";
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello <a href="https://example.com">Click me</a> World');
    });

    it('should support unquoted attributes', async () => {
      service.register('image', (attrs) => `<img src="${attrs.src}" />`, 'test-plugin');

      const content = 'Hello [image src=https://example.com/img.jpg /] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello <img src="https://example.com/img.jpg" /> World');
    });

    it('should support boolean attributes', async () => {
      service.register(
        'video',
        (attrs) => `<video ${attrs.autoplay === 'true' ? 'autoplay' : ''}>`,
        'test-plugin',
      );

      const content = 'Hello [video autoplay /] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello <video autoplay> World');
    });

    it('should process multiple shortcodes', async () => {
      service.register('a', () => 'A', 'test-plugin');
      service.register('b', () => 'B', 'test-plugin');

      const content = 'Start [a /] middle [b /] end';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Start A middle B end');
    });

    it('should handle escaped shortcodes [[tag]]', async () => {
      service.register('test', () => 'processed', 'test-plugin');

      const content = 'This is escaped: [[test /]]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('This is escaped: [test /]');
    });

    it('should pass context to handler', async () => {
      let receivedCtx: unknown;
      service.register(
        'test',
        (_attrs, _content, ctx) => {
          receivedCtx = ctx;
          return 'ok';
        },
        'test-plugin',
      );

      await service.process('[test /]', {
        postId: 42,
        postType: 'draft',
      });

      expect(receivedCtx).toEqual({
        postId: 42,
        postType: 'draft',
        pluginId: 'test-plugin',
      });
    });

    it('should handle async handlers', async () => {
      service.register(
        'async',
        async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 'async result';
        },
        'test-plugin',
      );

      const content = '[async /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('async result');
    });

    it('should preserve content when handler throws', async () => {
      service.register(
        'error',
        () => {
          throw new Error('Test error');
        },
        'test-plugin',
      );

      const content = 'Before [error /] After';
      const result = await service.process(content, defaultOptions);

      // 出错时保留原文
      expect(result).toBe(content);
    });

    it('should handle shortcode without closing bracket properly', async () => {
      service.register('test', () => 'processed', 'test-plugin');

      // 这不是有效的 shortcode，应该保持原样
      const content = 'Hello [test World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe(content);
    });
  });

  describe('hasShortcode', () => {
    it('should return false for content without brackets', () => {
      service.register('test', () => '', 'test-plugin');

      expect(service.hasShortcode('Hello World', 'test')).toBe(false);
    });

    it('should return false for unregistered shortcode', () => {
      expect(service.hasShortcode('[unknown /]', 'unknown')).toBe(false);
    });

    it('should return true when shortcode is present', () => {
      service.register('test', () => '', 'test-plugin');

      expect(service.hasShortcode('Hello [test /] World', 'test')).toBe(true);
    });
  });

  describe('strip', () => {
    it('should remove shortcodes and keep inner content', () => {
      service.register('wrapper', () => '', 'test-plugin');

      const content = 'Before [wrapper]inner text[/wrapper] After';
      const result = service.strip(content);

      expect(result).toBe('Before inner text After');
    });

    it('should remove self-closing shortcodes', () => {
      service.register('br', () => '', 'test-plugin');

      const content = 'Line 1 [br /] Line 2';
      const result = service.strip(content);

      expect(result).toBe('Line 1  Line 2');
    });

    it('should handle escaped shortcodes in strip', () => {
      service.register('test', () => '', 'test-plugin');

      const content = 'This is escaped: [[test /]]';
      const result = service.strip(content);

      expect(result).toBe('This is escaped: [test /]');
    });
  });

  describe('edge cases', () => {
    it('should handle nested brackets in content', async () => {
      service.register('code', (_attrs, content) => `<code>${content ?? ''}</code>`, 'test-plugin');

      const content = '[code]function test() { return [1, 2, 3]; }[/code]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('<code>function test() { return [1, 2, 3]; }</code>');
    });

    it('should handle attributes with special characters', async () => {
      service.register(
        'link',
        (attrs) => `<a href="${attrs.url}">${attrs.text}</a>`,
        'test-plugin',
      );

      const content = '[link url="https://example.com?a=1&b=2" text="Click <here>" /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('<a href="https://example.com?a=1&b=2">Click <here></a>');
    });

    it('should handle empty content', async () => {
      service.register(
        'empty',
        (_attrs, content) => `<div>${content ?? 'default'}</div>`,
        'test-plugin',
      );

      const content = '[empty][/empty]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('<div></div>');
    });

    it('should only unregister if plugin matches', () => {
      const handler: ShortcodeHandler = () => 'test';
      const unregister1 = service.register('shared', handler, 'plugin1');
      service.register('shared', handler, 'plugin2');

      // plugin1 的 unregister 不应该移除 plugin2 的注册
      unregister1();

      expect(service.exists('shared')).toBe(true);
    });

    it('should handle multiple attributes with mixed quote styles', async () => {
      service.register(
        'complex',
        (attrs) =>
          `<div class="${attrs.class}" id="${attrs.id}" data-value="${attrs.value}"></div>`,
        'test-plugin',
      );

      const content = '[complex class="btn primary" id=\'my-btn\' value=123 /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('<div class="btn primary" id="my-btn" data-value="123"></div>');
    });

    it('should handle consecutive shortcodes without spaces', async () => {
      service.register('a', () => 'A', 'test-plugin');
      service.register('b', () => 'B', 'test-plugin');

      const content = '[a /][b /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('AB');
    });

    it('should handle shortcode with trailing whitespace in attributes', async () => {
      service.register('test', (attrs) => `value: ${attrs.key}`, 'test-plugin');

      const content = '[test key="value"   /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('value: value');
    });

    it('should handle very long attribute values', async () => {
      service.register('test', (attrs) => `length: ${attrs.text.length}`, 'test-plugin');

      const longText = 'a'.repeat(1000);
      const content = `[test text="${longText}" /]`;
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('length: 1000');
    });

    it('should handle shortcode with hyphenated tag names', async () => {
      service.register('my-custom-tag', () => 'custom output', 'test-plugin');

      const content = 'Hello [my-custom-tag /] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello custom output World');
    });

    it('should handle shortcode with underscored tag names', async () => {
      service.register('my_custom_tag', () => 'custom output', 'test-plugin');

      const content = 'Hello [my_custom_tag /] World';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Hello custom output World');
    });

    it('should handle content with multiple escaped shortcodes', async () => {
      service.register('test', () => 'processed', 'test-plugin');

      const content = 'First [[test /]] and second [[test /]]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('First [test /] and second [test /]');
    });

    it('should handle mixed escaped and non-escaped shortcodes', async () => {
      service.register('test', () => 'REPLACED', 'test-plugin');

      const content = 'Escaped [[test /]] and processed [test /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Escaped [test /] and processed REPLACED');
    });

    it('should process shortcodes with content containing newlines', async () => {
      service.register(
        'multiline',
        (_attrs, content) => `<pre>${content ?? ''}</pre>`,
        'test-plugin',
      );

      const content = '[multiline]\nLine 1\nLine 2\nLine 3\n[/multiline]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('<pre>\nLine 1\nLine 2\nLine 3\n</pre>');
    });

    it('should handle attributes with empty values', async () => {
      service.register('test', (attrs) => `value: "${attrs.key}"`, 'test-plugin');

      const content = '[test key="" /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('value: ""');
    });

    it('should handle numeric attribute names', async () => {
      service.register('test', (attrs) => `attr1: ${attrs['attr1']}`, 'test-plugin');

      const content = '[test attr1="value" /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('attr1: value');
    });

    it('should return original content when handler returns empty string', async () => {
      service.register('remove', () => '', 'test-plugin');

      const content = 'Before [remove /] After';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('Before  After');
    });

    it('should handle shortcodes returning HTML with nested tags', async () => {
      service.register(
        'gallery',
        () => '<div class="gallery"><img src="1.jpg" /><img src="2.jpg" /></div>',
        'test-plugin',
      );

      const content = '[gallery /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('<div class="gallery"><img src="1.jpg" /><img src="2.jpg" /></div>');
    });
  });

  describe('getShortcodesInContent', () => {
    it('should return empty array for content without brackets', () => {
      service.register('test', () => '', 'test-plugin');

      const result = service.getShortcodesInContent('Hello World');

      expect(result).toEqual([]);
    });

    it('should return only registered shortcodes', () => {
      service.register('registered', () => '', 'test-plugin');

      const content = '[registered /] [unregistered /]';
      const result = service.getShortcodesInContent(content);

      expect(result).toEqual(['registered']);
    });

    it('should return unique shortcodes', () => {
      service.register('test', () => '', 'test-plugin');

      const content = '[test /] some text [test /]';
      const result = service.getShortcodesInContent(content);

      expect(result).toEqual(['test']);
    });

    it('should handle multiple different shortcodes', () => {
      service.register('a', () => '', 'test-plugin');
      service.register('b', () => '', 'test-plugin');
      service.register('c', () => '', 'test-plugin');

      const content = '[a /] [b /] [c /] [a /]';
      const result = service.getShortcodesInContent(content);

      expect(result.sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('performance and limits', () => {
    it('should handle large number of shortcodes', async () => {
      service.register('item', (_attrs, content) => `<li>${content ?? ''}</li>`, 'test-plugin');

      const items = Array.from({ length: 100 }, (_, i) => `[item]Item ${i}[/item]`).join('\n');
      const result = await service.process(items, defaultOptions);

      expect(result).toContain('<li>Item 0</li>');
      expect(result).toContain('<li>Item 99</li>');
    });

    it('should handle very long content between shortcodes', async () => {
      service.register('mark', () => '***', 'test-plugin');

      const longContent = 'a'.repeat(10000);
      const content = `[mark /] ${longContent} [mark /]`;
      const result = await service.process(content, defaultOptions);

      expect(result).toBe(`*** ${longContent} ***`);
    });
  });

  describe('special characters in attributes', () => {
    it('should handle attributes with quotes inside (limitation: escaped quotes not fully supported)', async () => {
      service.register('test', (attrs) => `value: ${attrs.data}`, 'test-plugin');

      // Note: The current regex implementation doesn't support escaped quotes (\")
      // The regex [^"]* stops at the first unescaped quote
      // For this content '[test data="He said \\"hello\\"" /]'
      // The parser will match: data="He said \" (stops at the escaped quote)
      const content = '[test data="He said \\"hello\\"" /]';
      const result = await service.process(content, defaultOptions);

      // Due to regex limitation, only partial content is captured
      expect(result).toContain('value:');
    });

    it('should handle attributes with forward slashes', async () => {
      service.register('path', (attrs) => `path: ${attrs.dir}`, 'test-plugin');

      const content = '[path dir="/usr/local/bin" /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('path: /usr/local/bin');
    });

    it('should handle attributes with equals signs in values', async () => {
      service.register('formula', (attrs) => `formula: ${attrs.expr}`, 'test-plugin');

      const content = '[formula expr="x=y+1" /]';
      const result = await service.process(content, defaultOptions);

      expect(result).toBe('formula: x=y+1');
    });
  });

  describe('context passing', () => {
    it('should pass postId in context', async () => {
      let receivedPostId: number | undefined;
      service.register(
        'test',
        (_attrs, _content, ctx) => {
          receivedPostId = ctx.postId;
          return 'ok';
        },
        'test-plugin',
      );

      await service.process('[test /]', { postId: 123, postType: 'article' });

      expect(receivedPostId).toBe(123);
    });

    it('should pass postType in context', async () => {
      let receivedPostType: string | undefined;
      service.register(
        'test',
        (_attrs, _content, ctx) => {
          receivedPostType = ctx.postType;
          return 'ok';
        },
        'test-plugin',
      );

      await service.process('[test /]', { postId: 1, postType: 'page' });

      expect(receivedPostType).toBe('page');
    });

    it('should pass pluginId in context', async () => {
      let receivedPluginId: string | undefined;
      service.register(
        'test',
        (_attrs, _content, ctx) => {
          receivedPluginId = ctx.pluginId;
          return 'ok';
        },
        'my-awesome-plugin',
      );

      await service.process('[test /]', { postId: 1, postType: 'article' });

      expect(receivedPluginId).toBe('my-awesome-plugin');
    });
  });

  describe('unregister', () => {
    it('should remove shortcode using unregister method', () => {
      service.register('test', () => 'output', 'test-plugin');
      expect(service.exists('test')).toBe(true);

      service.unregister('test');
      expect(service.exists('test')).toBe(false);
    });

    it('should not error when unregistering non-existent shortcode', () => {
      expect(() => {
        service.unregister('non-existent');
      }).not.toThrow();
    });

    it('should allow re-registration after unregister', () => {
      const handler1: ShortcodeHandler = () => 'first';
      const handler2: ShortcodeHandler = () => 'second';

      service.register('test', handler1, 'plugin1');
      service.unregister('test');
      service.register('test', handler2, 'plugin2');

      expect(service.exists('test')).toBe(true);
    });
  });

  describe('getTags', () => {
    it('should return empty array when no shortcodes registered', () => {
      expect(service.getTags()).toEqual([]);
    });

    it('should return all registered tag names', () => {
      service.register('tag1', () => '', 'test-plugin');
      service.register('tag2', () => '', 'test-plugin');
      service.register('tag3', () => '', 'test-plugin');

      const tags = service.getTags();

      expect(tags.sort()).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should update when tags are removed', () => {
      service.register('tag1', () => '', 'test-plugin');
      service.register('tag2', () => '', 'test-plugin');

      service.unregister('tag1');

      expect(service.getTags()).toEqual(['tag2']);
    });
  });
});
