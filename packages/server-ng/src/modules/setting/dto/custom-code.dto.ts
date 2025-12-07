import { z } from 'zod';

export const UpdateCustomCodeSchema = z.object({
  css: z.string().optional().describe('Custom CSS styles'),
  script: z.string().optional().describe('Custom JavaScript code'),
  html: z.string().optional().describe('Custom HTML content'),
  head: z.string().optional().describe('Custom code to inject in <head> tag'),
});

export type UpdateCustomCodeDto = z.infer<typeof UpdateCustomCodeSchema>;
