import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { commonSchemas } from '../../../shared/zod';

export const RewardInfoSchema = z.object({
  name: commonSchemas.nonEmptyString.describe('Payment method name (e.g., Alipay, WeChat Pay)'),
  value: commonSchemas.nonEmptyString.describe('Payment value (e.g., QR code URL or account)'),
});

export class RewardInfoDto extends createZodDto(RewardInfoSchema) {}
