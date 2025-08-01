import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateLayoutSchema = z.object({
  showRecentPosts: z.boolean().describe('是否显示最近文章'),
  recentPostsCount: z.number().min(1).max(20).describe('最近文章数量'),
  showCategories: z.boolean().describe('是否显示分类'),
  showTags: z.boolean().describe('是否显示标签'),
  showArchive: z.boolean().describe('是否显示归档'),
  showAbout: z.boolean().describe('是否显示关于'),
  showSearch: z.boolean().describe('是否显示搜索'),
});

export class UpdateLayoutDto extends createZodDto(UpdateLayoutSchema) {}
