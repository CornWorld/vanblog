import { createZodDto } from 'nestjs-zod';
import { CreateUserSchema } from './create-user.dto';

export const UpdateUserSchema = CreateUserSchema.omit({ username: true }).partial();

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
