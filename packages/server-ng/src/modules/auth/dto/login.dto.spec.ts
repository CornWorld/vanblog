import { describe, it, expect } from 'vitest';
import { LoginSchema } from './login.dto';

describe('LoginDto', () => {
  describe('LoginSchema validation', () => {
    it('should accept valid login credentials', () => {
      const validData = {
        username: 'admin',
        password: 'password123',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('admin');
        expect(result.data.password).toBe('password123');
      }
    });

    it('should accept username with special characters', () => {
      const validData = {
        username: 'user@example.com',
        password: 'password',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept username with numbers', () => {
      const validData = {
        username: 'user123',
        password: 'pass456',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept long passwords', () => {
      const validData = {
        username: 'admin',
        password: 'a'.repeat(100),
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty username', () => {
      const invalidData = {
        username: '',
        password: 'password',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Username is required');
      }
    });

    it('should reject empty password', () => {
      const invalidData = {
        username: 'admin',
        password: '',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Password is required');
      }
    });

    it('should reject missing username', () => {
      const invalidData = {
        password: 'password',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const invalidData = {
        username: 'admin',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject null username', () => {
      const invalidData = {
        username: null,
        password: 'password',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject null password', () => {
      const invalidData = {
        username: 'admin',
        password: null,
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject undefined username', () => {
      const invalidData = {
        username: undefined,
        password: 'password',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject undefined password', () => {
      const invalidData = {
        username: 'admin',
        password: undefined,
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-string username', () => {
      const invalidData = {
        username: 12345,
        password: 'password',
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-string password', () => {
      const invalidData = {
        username: 'admin',
        password: 12345,
      };

      const result = LoginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should ignore extra fields', () => {
      const dataWithExtra = {
        username: 'admin',
        password: 'password',
        extra: 'field',
      };

      const result = LoginSchema.safeParse(dataWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('extra');
      }
    });

    it('should handle whitespace in username', () => {
      const validData = {
        username: '  admin  ',
        password: 'password',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('  admin  ');
      }
    });

    it('should handle whitespace in password', () => {
      const validData = {
        username: 'admin',
        password: '  password  ',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('  password  ');
      }
    });

    it('should handle unicode characters in username', () => {
      const validData = {
        username: '用户名',
        password: 'password',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle unicode characters in password', () => {
      const validData = {
        username: 'admin',
        password: '密码123',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle special characters in password', () => {
      const validData = {
        username: 'admin',
        password: 'P@ssw0rd!#$%^&*()',
      };

      const result = LoginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
