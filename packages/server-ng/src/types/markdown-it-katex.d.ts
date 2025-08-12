declare module 'markdown-it-katex' {
  import type MarkdownIt from 'markdown-it';

  interface KatexOptions {
    throwOnError?: boolean;
    errorColor?: string;
    [key: string]: unknown;
  }

  function katex(md: MarkdownIt, options?: KatexOptions): void;

  export = katex;
}
