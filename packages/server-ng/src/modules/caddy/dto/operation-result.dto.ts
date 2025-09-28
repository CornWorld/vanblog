import { createZodDto } from 'nestjs-zod';

import { OperationResultSchema } from '../caddy.schema';

export class OperationResultDto extends createZodDto(OperationResultSchema) {}
