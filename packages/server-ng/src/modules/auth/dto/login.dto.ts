import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export class LoginDto extends createZodDto(LoginSchema) {}

export type LoginType = z.infer<typeof LoginSchema>;
