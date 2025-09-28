import { createZodDto } from 'nestjs-zod';

import { HttpsSettingsSchema } from '../caddy.schema';

export class HttpsSettingsDto extends createZodDto(HttpsSettingsSchema) {}
export class UpdateHttpsSettingsDto extends createZodDto(HttpsSettingsSchema) {}
