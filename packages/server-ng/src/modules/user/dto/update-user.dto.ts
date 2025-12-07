import { z } from 'zod';

import { updateUserSchema } from '../../../database';

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
