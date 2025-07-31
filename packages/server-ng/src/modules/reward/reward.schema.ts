import { z } from 'zod';

export const RewardInfoSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const RewardInfoArraySchema = z.array(RewardInfoSchema);

export type RewardInfo = z.infer<typeof RewardInfoSchema>;
