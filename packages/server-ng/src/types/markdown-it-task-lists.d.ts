declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';

  interface TaskListsOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
    [key: string]: unknown;
  }

  function taskLists(md: MarkdownIt, options?: TaskListsOptions): void;

  export = taskLists;
}
