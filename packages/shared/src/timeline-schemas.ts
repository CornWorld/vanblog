import { z } from 'zod';
import { dataCodec, dateStr } from './date-codecs.js';

export const TimelineArticleInputSchema = z.object({
  id: z.number(),
  title: z.string(),
  pathname: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  author: z.string().nullable(),
  top: z.number().nullable(),
  hidden: z.boolean(),
  private: z.boolean(),
  viewer: z.number(),
  createdAt: dateStr,
  updatedAt: dateStr,
});

export type TimelineArticleInput = z.input<typeof TimelineArticleInputSchema>;

export type TimelineArticleDecoded = Omit<
  z.output<typeof TimelineArticleInputSchema>,
  'createdAt' | 'updatedAt'
> & {
  createdAt: import('dayjs').Dayjs;
  updatedAt: import('dayjs').Dayjs;
};

export const TimelineArticleOutputSchema = z.object({
  id: z.number(),
  title: z.string(),
  pathname: z.string().nullable(),
  tags: z.array(z.string()),
  category: z.string().nullable(),
  author: z.string().nullable(),
  top: z.number().nullable(),
  hidden: z.boolean(),
  private: z.boolean(),
  viewer: z.number(),
  createdAt: dateStr,
  updatedAt: dateStr,
});

export type TimelineArticleOutput = z.output<typeof TimelineArticleOutputSchema>;

export function decodeTimelineArticle(input: TimelineArticleInput): TimelineArticleDecoded {
  return {
    ...input,
    createdAt: dataCodec.decode(input.createdAt),
    updatedAt: dataCodec.decode(input.updatedAt),
  } as TimelineArticleDecoded;
}

export function encodeTimelineArticle(decoded: TimelineArticleDecoded): TimelineArticleInput {
  return {
    ...decoded,
    createdAt: dataCodec.encode(decoded.createdAt),
    updatedAt: dataCodec.encode(decoded.updatedAt),
  } as TimelineArticleInput;
}

export type TimelineArticleDbRow = {
  id: number;
  title: string;
  pathname: string | null;
  tags: string | null;
  category: string | null;
  author: string | null;
  top: number | null;
  hidden: boolean | null;
  private: boolean | null;
  viewer: number | null;
  createdAt: string;
  updatedAt: string;
};

export function toTimelineArticleInputFromDb(row: TimelineArticleDbRow): TimelineArticleInput {
  let parsedTags: string[] = [];
  if (row.tags && row.tags.length > 0) {
    try {
      const v: unknown = JSON.parse(row.tags);
      if (Array.isArray(v)) parsedTags = v.filter((t): t is string => typeof t === 'string');
    } catch {
      parsedTags = [];
    }
  }

  return {
    id: row.id,
    title: row.title,
    pathname: row.pathname,
    tags: parsedTags,
    category: row.category,
    author: row.author,
    top: row.top,
    hidden: !!row.hidden,
    private: !!row.private,
    viewer: row.viewer ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } satisfies TimelineArticleInput;
}
