import { createZodDto } from 'nestjs-zod';

import { CaddyLogSchema } from '../caddy.schema';

export class CaddyLogDto extends createZodDto(CaddyLogSchema) {}
