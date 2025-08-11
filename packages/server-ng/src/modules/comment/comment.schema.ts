import { z } from 'zod';

export const WalineSettingSchema = z.object({
  'smtp.enabled': z.boolean().default(false),
  'smtp.port': z.number().int().positive().default(587),
  'smtp.host': z.string().default(''),
  'smtp.user': z.string().default(''),
  'smtp.password': z.string().default(''),
  'sender.name': z.string().default(''),
  'sender.email': z.string().email().default(''),
  authorEmail: z.string().email().default(''),
  webhook: z.string().url().optional(),
  forceLoginComment: z.boolean().default(false),
  otherConfig: z.string().optional(),
  serverURL: z.string().url().optional(),
});

export type WalineSetting = z.infer<typeof WalineSettingSchema>;

export const UpdateWalineSettingSchema = WalineSettingSchema.partial();
export type UpdateWalineSetting = z.infer<typeof UpdateWalineSettingSchema>;
