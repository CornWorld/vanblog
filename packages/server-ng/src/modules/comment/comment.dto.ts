import { createZodDto } from 'nestjs-zod';

import { UpdateWalineSettingSchema, WalineSettingSchema } from './comment.schema';

export class WalineSettingDto extends createZodDto(WalineSettingSchema) {}
export class UpdateWalineSettingDto extends createZodDto(UpdateWalineSettingSchema) {}
