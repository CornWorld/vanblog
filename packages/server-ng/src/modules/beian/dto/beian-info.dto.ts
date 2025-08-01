import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BeianInfoSchema = z.object({
  icp: z.string().optional().describe('ICP beian number'),
  gov: z.string().optional().describe('Gov beian number'),
  govUrl: z.string().optional().describe('Gov beian URL'),
  showBeian: z.boolean().optional().describe('Whether to show beian information'),
});

export class BeianInfoDto extends createZodDto(BeianInfoSchema) {}
