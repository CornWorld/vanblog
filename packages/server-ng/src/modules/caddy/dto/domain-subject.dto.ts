import { createZodDto } from 'nestjs-zod';

import { DomainSubjectSchema } from '../caddy.schema';

export class DomainSubjectDto extends createZodDto(DomainSubjectSchema) {}
export class AddDomainSubjectDto extends createZodDto(DomainSubjectSchema) {}
