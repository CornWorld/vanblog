import { createZodDto } from 'nestjs-zod';

import { DomainListSchema } from '../caddy.schema';

export class DomainListDto extends createZodDto(DomainListSchema) {}
export class UpdateDomainListDto extends createZodDto(DomainListSchema) {}
