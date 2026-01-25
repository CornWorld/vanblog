import { updateUserSchema } from '@vanblog/shared/drizzle';
import { z } from 'zod';

export const UpdateUserSchema = updateUserSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    permissions: true,
  })
  .extend({
    permissions: z.array(z.string()).optional(),
  });

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
