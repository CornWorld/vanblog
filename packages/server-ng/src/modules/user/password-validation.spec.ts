import { describe, it, expect } from 'vitest';

import { insertUserSchema, updateUserSchema } from '@vanblog/shared/drizzle';

describe('Password Validation', () => {
  describe('insertUserSchema password validation', () => {
    const validUserData = {
      username: 'testuser',
      password: 'ValidPass123!',
      type: 'admin' as const,
    };

    it('should accept strong passwords', () => {
      const strongPasswords = [
        'ValidPass123!',
        'MySecure@Pass1',
        'Complex#Password9',
        'Strong$123Pass',
        'Secure&Pass456',
      ];

      strongPasswords.forEach((password) => {
        const result = insertUserSchema.safeParse({
          ...validUserData,
          password,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject passwords that are too short', () => {
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: 'Short1!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('密码至少8个字符');
      }
    });

    it('should reject passwords that are too long', () => {
      const longPassword = `${'A'.repeat(126)}a1!`; // 130 characters total
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: longPassword,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('密码最多128个字符');
      }
    });

    it('should reject passwords without lowercase letters', () => {
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: 'UPPERCASE123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('小写字母'))).toBe(true);
      }
    });

    it('should reject passwords without uppercase letters', () => {
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: 'lowercase123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('大写字母'))).toBe(true);
      }
    });

    it('should reject passwords without numbers', () => {
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: 'NoNumbers!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('数字'))).toBe(true);
      }
    });

    it('should reject passwords without special characters', () => {
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: 'NoSpecialChars123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes('特殊字符'))).toBe(true);
      }
    });

    it('should provide multiple error messages for multiple violations', () => {
      const result = insertUserSchema.safeParse({
        ...validUserData,
        password: 'weak',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message);
        expect(messages.some((msg) => msg.includes('8个字符'))).toBe(true);
        expect(messages.some((msg) => msg.includes('大写字母'))).toBe(true);
        expect(messages.some((msg) => msg.includes('数字'))).toBe(true);
        expect(messages.some((msg) => msg.includes('特殊字符'))).toBe(true);
      }
    });
  });

  describe('updateUserSchema password validation', () => {
    const validUpdateData = {
      username: 'testuser',
    };

    it('should accept strong passwords when updating', () => {
      const result = updateUserSchema.safeParse({
        ...validUpdateData,
        password: 'ValidPass123!',
      });
      expect(result.success).toBe(true);
    });

    it('should accept undefined password when updating', () => {
      const result = updateUserSchema.safeParse(validUpdateData);
      expect(result.success).toBe(true);
    });

    it('should reject weak passwords when updating', () => {
      const result = updateUserSchema.safeParse({
        ...validUpdateData,
        password: 'weak',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((issue) => issue.message);
        expect(messages.some((msg) => msg.includes('8个字符'))).toBe(true);
      }
    });
  });

  describe('Common password patterns', () => {
    const validUserData = {
      username: 'testuser',
      type: 'admin' as const,
    };

    it('should reject common weak patterns', () => {
      const weakPasswords = [
        'password123',
        '12345678',
        'qwerty123',
        'admin123',
        'Password',
        '123456789',
      ];

      weakPasswords.forEach((password) => {
        const result = insertUserSchema.safeParse({
          ...validUserData,
          password,
        });
        expect(result.success).toBe(false);
      });
    });

    it('should accept various special characters', () => {
      const specialChars = [
        '!',
        '@',
        '#',
        '$',
        '%',
        '^',
        '&',
        '*',
        '(',
        ')',
        '-',
        '_',
        '+',
        '=',
        '{',
        '}',
        '[',
        ']',
        '|',
        '\\',
        ':',
        ';',
        '"',
        "'",
        '<',
        '>',
        ',',
        '.',
        '?',
        '/',
        '~',
        '`',
      ];

      specialChars.forEach((char) => {
        const password = `ValidPass123${char}`;
        const result = insertUserSchema.safeParse({
          ...validUserData,
          password,
        });
        expect(result.success).toBe(true);
      });
    });
  });
});
