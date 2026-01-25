import { describe, it, expect } from 'vitest';

import { withPluginPrefix } from './prefix.util';

describe('withPluginPrefix', () => {
  it('joins pluginId and parts with colons', () => {
    expect(withPluginPrefix('cat-plugin', 'cache', 'hits')).toBe('cat-plugin:cache:hits');
  });

  it('handles numbers and trims whitespace', () => {
    expect(withPluginPrefix('p', '  a  ', 123, ' b ')).toBe('p:a:123:b');
  });

  it('skips null/undefined/empty parts', () => {
    expect(withPluginPrefix('p', null, undefined, '', 'x')).toBe('p:x');
  });

  it('works with single part', () => {
    expect(withPluginPrefix('p', 'only')).toBe('p:only');
  });

  it('works with no extra parts', () => {
    expect(withPluginPrefix('p')).toBe('p');
  });
});
