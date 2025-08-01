import { z } from 'zod';
import { commonSchemas } from '../../../shared/zod';

export const VerifyCategoryPasswordSchema = z.object({
  password: commonSchemas.nonEmptyString.describe('Password for private category'),
});

export const CategoryAccessResponseSchema = z.object({
  success: z.boolean().describe('Whether access is granted'),
  token: z.string().optional().describe('Access token for the category'),
  message: z.string().optional().describe('Error message if access is denied'),
});

export type VerifyCategoryPasswordDto = z.infer<typeof VerifyCategoryPasswordSchema>;
export type CategoryAccessResponseDto = z.infer<typeof CategoryAccessResponseSchema>;

// Class for Swagger documentation
export class CategoryAccessResponse {
  success!: boolean;
  token?: string;
  message?: string;
}
