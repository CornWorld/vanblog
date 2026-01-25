import type { UpdateWalineSettingSchema, WalineSettingSchema } from './comment.schema';
import type { z } from 'zod';

export type WalineSettingDto = z.infer<typeof WalineSettingSchema>;
export type UpdateWalineSettingDto = z.infer<typeof UpdateWalineSettingSchema>;
