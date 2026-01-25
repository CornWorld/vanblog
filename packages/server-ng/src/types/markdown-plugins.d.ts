import type { PluginSimple } from 'markdown-it';

declare module 'markdown-it-katex' {
  const katex: PluginSimple;
  export default katex;
}

declare module 'markdown-it-task-lists' {
  const taskLists: PluginSimple;
  export default taskLists;
}
