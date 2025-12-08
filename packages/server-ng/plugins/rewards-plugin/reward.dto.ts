import { z } from 'zod';

const nonEmptyString = z.string().min(1).trim();

export const RewardInfoSchema = z.object({
  name: nonEmptyString.describe('Payment method name (e.g., Alipay, WeChat Pay)'),
  value: nonEmptyString.describe('Payment value (e.g., QR code URL or account)'),
});

export type RewardInfoDto = z.infer<typeof RewardInfoSchema>;
