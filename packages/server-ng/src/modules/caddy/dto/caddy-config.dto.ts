import { createZodDto } from 'nestjs-zod';

import { CaddyConfigSchema } from '../caddy.schema';

export class CaddyConfigDto extends createZodDto(CaddyConfigSchema) {}
