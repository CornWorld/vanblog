import { createZodDto } from 'nestjs-zod';
import { updateUserSchema } from '../../../database';

export const UpdateUserSchema = updateUserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
