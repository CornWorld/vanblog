import type { z } from 'zod';
import { CreateUserSchema } from './create-user.dto';

export const UpdateUserSchema = CreateUserSchema.omit({ username: true }).partial();

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
