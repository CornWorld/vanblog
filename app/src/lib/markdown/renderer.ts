import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import type { MarkdownRenderer } from '@astrojs/internal-helpers/markdown';
import { sharedMarkdownConfig } from './config';

let _renderer: MarkdownRenderer | null = null;
let _initPromise: Promise<MarkdownRenderer> | null = null;

/** Get (lazy init) Astro's official markdown renderer. Thread-safe. */
export function getRenderer(): Promise<MarkdownRenderer> {
  if (_renderer) return Promise.resolve(_renderer);
  if (!_initPromise) {
    _initPromise = createMarkdownProcessor(sharedMarkdownConfig).then((r) => {
      _renderer = r;
      return r;
    });
  }
  return _initPromise;
}

/** Convenience: markdown → HTML */
export async function renderMarkdown(md: string, fileURL?: URL) {
  const renderer = await getRenderer();
  return renderer.render(md, fileURL ? { fileURL } : undefined);
}
