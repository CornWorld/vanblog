import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateCustomCodeSchema = z.object({
  head: z.string().optional().describe('Custom code to inject in <head> tag'),
  body: z.string().optional().describe('Custom code to inject in <body> tag'),
  footer: z.string().optional().describe('Custom code to inject before </body> tag'),
});

export class UpdateCustomCodeDto extends createZodDto(UpdateCustomCodeSchema) {}
