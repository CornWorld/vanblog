import { z } from 'zod';

export const UpdateAboutSchema = z.object({
  content: z.string().describe('关于页 Markdown/HTML 内容'),
});

export type UpdateAboutDto = z.infer<typeof UpdateAboutSchema>;
