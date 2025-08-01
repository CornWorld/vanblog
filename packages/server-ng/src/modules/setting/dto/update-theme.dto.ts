import { z } from 'zod';

export const UpdateThemeSchema = z.object({
  theme: z.string().min(1, '主题名称不能为空'),
  config: z.record(z.string(), z.unknown()).optional(),
  customCss: z.string().optional(),
  customJs: z.string().optional(),
  customHead: z.string().optional(),
  customFooter: z.string().optional(),
});

export type UpdateThemeDto = z.infer<typeof UpdateThemeSchema>;
