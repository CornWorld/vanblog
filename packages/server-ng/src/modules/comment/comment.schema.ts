import { z } from 'zod';

export const WalineSettingSchema = z.object({
  'smtp.enabled': z.boolean().default(false),
  'smtp.port': z.number().int().positive().default(587),
  'smtp.host': z.string().default(''),
  'smtp.user': z.string().default(''),
  'smtp.password': z.string().default(''),
  'sender.name': z.string().default(''),
  'sender.email': z.string().pipe(z.email()).default(''),
  authorEmail: z.string().pipe(z.email()).default(''),
  webhook: z.string().pipe(z.url()).optional(),
  forceLoginComment: z.boolean().default(false),
  otherConfig: z.string().optional(),
  serverURL: z.string().pipe(z.url()).optional(),
});

export type WalineSetting = z.infer<typeof WalineSettingSchema>;

export const UpdateWalineSettingSchema = z.object({
  'smtp.enabled': z.boolean().optional(),
  'smtp.port': z.number().int().positive().optional(),
  'smtp.host': z.string().optional(),
  'smtp.user': z.string().optional(),
  'smtp.password': z.string().optional(),
  'sender.name': z.string().optional(),
  'sender.email': z.string().pipe(z.email()).optional(),
  authorEmail: z.string().pipe(z.email()).optional(),
  webhook: z.string().pipe(z.url()).optional(),
  forceLoginComment: z.boolean().optional(),
  otherConfig: z.string().optional(),
  serverURL: z.string().pipe(z.url()).optional(),
});
export type UpdateWalineSetting = z.infer<typeof UpdateWalineSettingSchema>;
