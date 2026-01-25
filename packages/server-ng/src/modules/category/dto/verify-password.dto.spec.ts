import { describe, it, expect } from 'vitest';
import {
  VerifyCategoryPasswordSchema,
  CategoryAccessResponseSchema,
  type VerifyCategoryPasswordDto,
  type CategoryAccessResponseDto,
} from './verify-password.dto';

describe('Category DTOs', () => {
  describe('VerifyCategoryPasswordSchema', () => {
    it('should validate a valid password', () => {
      const data = { password: 'myPassword123' };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('myPassword123');
      }
    });

    it('should validate password with special characters', () => {
      const data = { password: 'p@ssw0rd!#$%^&*()' };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('p@ssw0rd!#$%^&*()');
      }
    });

    it('should validate password with spaces', () => {
      const data = { password: 'my pass word' };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('my pass word');
      }
    });

    it('should reject empty password', () => {
      const data = { password: '' };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject missing password field', () => {
      const data = {};
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject null password', () => {
      const data = { password: null };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject undefined password', () => {
      const data = { password: undefined };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject non-string password', () => {
      const data = { password: 12345 };
      const result = VerifyCategoryPasswordSchema.safeParse(data);

      expect(result.success).toBe(false);
    });
  });

  describe('CategoryAccessResponseSchema', () => {
    it('should validate successful access response with all fields', () => {
      const data = {
        success: true,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        message: 'Access granted',
      };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        expect(result.data.message).toBe('Access granted');
      }
    });

    it('should validate successful access response with token only', () => {
      const data = {
        success: true,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        expect(result.data.message).toBeUndefined();
      }
    });

    it('should validate failed access response with message', () => {
      const data = {
        success: false,
        message: 'Invalid password',
      };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.message).toBe('Invalid password');
        expect(result.data.token).toBeUndefined();
      }
    });

    it('should validate minimal response with only success field', () => {
      const data = { success: true };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.token).toBeUndefined();
        expect(result.data.message).toBeUndefined();
      }
    });

    it('should validate failed response without optional fields', () => {
      const data = { success: false };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
      }
    });

    it('should require success field', () => {
      const data = { token: 'some-token' };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should validate token as optional', () => {
      const data = { success: true };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should validate message as optional', () => {
      const data = { success: false };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should reject non-boolean success', () => {
      const data = { success: 'true' };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject non-string token', () => {
      const data = { success: true, token: 12345 };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should reject non-string message', () => {
      const data = { success: false, message: 123 };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(false);
    });

    it('should allow empty string message', () => {
      const data = { success: false, message: '' };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
    });

    it('should allow empty string token', () => {
      const data = { success: true, token: '' };
      const result = CategoryAccessResponseSchema.safeParse(data);

      expect(result.success).toBe(true);
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer VerifyCategoryPasswordDto type', () => {
      const dto: VerifyCategoryPasswordDto = { password: 'test' };
      expect(dto.password).toBe('test');
    });

    it('should correctly infer CategoryAccessResponseDto type', () => {
      const dto: CategoryAccessResponseDto = { success: true, token: 'token' };
      expect(dto.success).toBe(true);
      expect(dto.token).toBe('token');
    });

    it('should allow optional fields in CategoryAccessResponseDto', () => {
      const dto: CategoryAccessResponseDto = { success: false };
      expect(dto.success).toBe(false);
      expect(dto.token).toBeUndefined();
      expect(dto.message).toBeUndefined();
    });
  });
});
