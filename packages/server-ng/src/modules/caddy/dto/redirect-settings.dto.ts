import { createZodDto } from 'nestjs-zod';

import { RedirectSettingsSchema } from '../caddy.schema';

export class RedirectSettingsDto extends createZodDto(RedirectSettingsSchema) {}
export class UpdateRedirectSettingsDto extends createZodDto(RedirectSettingsSchema) {}
