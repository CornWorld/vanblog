import { z } from 'zod';

export const BeianInfoSchema = z.object({
  icp: z.string().optional(),
  gov: z.string().optional(),
  govUrl: z.string().optional(),
  showBeian: z.boolean().optional(),
});

export type BeianInfo = z.infer<typeof BeianInfoSchema>;
