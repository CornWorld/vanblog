import { z } from 'zod';

// 简化的通用 schema，避免依赖外部模块
const nonEmptyString = z.string().min(1).trim();

export const RewardInfoSchema = z.object({
  name: nonEmptyString.describe('Payment method name (e.g., Alipay, WeChat Pay)'),
  value: nonEmptyString.describe('Payment value (e.g., QR code URL or account)'),
});

export type RewardInfoDto = z.infer<typeof RewardInfoSchema>;
