import { z } from 'zod';
import { dayjs } from './dayjs.js';

export const dateStr = z
  .string()
  .refine((val) => dayjs(val).isValid(), { message: 'Invalid date string' })
  .describe('ISO 8601 date string with timezone');

export const dataCodec = z.codec(
  dateStr,
  z.custom<import('dayjs').Dayjs>((v) => dayjs.isDayjs(v)),
  {
    decode: (s) => dayjs(s),
    encode: (d) => d.format() as z.infer<typeof dateStr>,
  },
);
