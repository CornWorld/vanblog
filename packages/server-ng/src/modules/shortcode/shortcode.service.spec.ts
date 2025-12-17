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
  });
});
