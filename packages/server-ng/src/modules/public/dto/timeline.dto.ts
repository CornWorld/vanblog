import type { TimelineArticleInput } from '@vanblog/shared';

export type TimelineQueryDto = { includeHidden?: boolean };
export type TimelineResponseDto = Record<string, TimelineArticleInput[]>;
