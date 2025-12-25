import { describe, it, expect } from 'vitest';
import { VerifyArticlePasswordSchema, ArticleAccessResponseSchema } from './verify-password.dto';

describe('Verify Article Password DTOs', () => {
  describe('VerifyArticlePasswordSchema', () => {
    it('should validate valid password', () => {
      const validData = {
        password: 'my-secret-password',
      };

      const result = VerifyArticlePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBe('my-secret-password');
      }
    });

    it('should validate password with special characters', () => {
      const validData = {
        password: 'P@ssw0rd!@#$%^&*()',
      };

      const result = VerifyArticlePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate password with spaces', () => {
      const validData = {
        password: 'password with spaces',
      };

      const result = VerifyArticlePasswordSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const emptyPassword = {
        password: '',
      };

      const result = VerifyArticlePasswordSchema.safeParse(emptyPassword);
      expect(result.success).toBe(false);
    });

    it('should accept whitespace-only password (nonEmptyString allows it)', () => {
      const whitespacePassword = {
        password: '   ',
      };

      const result = VerifyArticlePasswordSchema.safeParse(whitespacePassword);
      // c.nonEmptyString only checks min(1), doesn't trim or reject whitespace
      expect(result.success).toBe(true);
    });

    it('should reject missing password field', () => {
      const missingPassword = {};

      const result = VerifyArticlePasswordSchema.safeParse(missingPassword);
      expect(result.success).toBe(false);
    });

    it('should reject null password', () => {
      const nullPassword = {
        password: null,
      };

      const result = VerifyArticlePasswordSchema.safeParse(nullPassword);
      expect(result.success).toBe(false);
    });

    it('should reject undefined password', () => {
      const undefinedPassword = {
        password: undefined,
      };

      const result = VerifyArticlePasswordSchema.safeParse(undefinedPassword);
      expect(result.success).toBe(false);
    });

    it('should not trim whitespace from password (no transform applied)', () => {
      const paddedPassword = {
        password: '  my-password  ',
      };

      const result = VerifyArticlePasswordSchema.safeParse(paddedPassword);
      expect(result.success).toBe(true);
      if (result.success) {
        // c.nonEmptyString doesn't apply .trim() - password is preserved as-is
        expect(result.data.password).toBe('  my-password  ');
      }
    });
  });

  describe('ArticleAccessResponseSchema', () => {
    it('should validate successful access response with all fields', () => {
      const validResponse = {
        success: true,
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        message: 'Access granted',
        expiresAt: '2024-12-31T23:59:59.000Z',
      };

      const result = ArticleAccessResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validResponse);
      }
    });

    it('should validate successful access response with token only', () => {
      const validResponse = {
        success: true,
        token: 'access-token-12345',
      };

      const result = ArticleAccessResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate failed access response with message', () => {
      const failedResponse = {
        success: false,
        message: 'Incorrect password',
      };

      const result = ArticleAccessResponseSchema.safeParse(failedResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(false);
        expect(result.data.message).toBe('Incorrect password');
      }
    });

    it('should validate minimal response with only success field', () => {
      const minimalResponse = {
        success: true,
      };

      const result = ArticleAccessResponseSchema.safeParse(minimalResponse);
      expect(result.success).toBe(true);
    });

    it('should validate failed response without optional fields', () => {
      const failedResponse = {
        success: false,
      };

      const result = ArticleAccessResponseSchema.safeParse(failedResponse);
      expect(result.success).toBe(true);
    });

    it('should require success field', () => {
      const missingSuccess = {
        token: 'some-token',
        message: 'some message',
      };

      const result = ArticleAccessResponseSchema.safeParse(missingSuccess);
      expect(result.success).toBe(false);
    });

    it('should validate token as optional', () => {
      const withoutToken = {
        success: true,
        message: 'Success',
        expiresAt: '2024-12-31T23:59:59.000Z',
      };

      const result = ArticleAccessResponseSchema.safeParse(withoutToken);
      expect(result.success).toBe(true);
    });

    it('should validate message as optional', () => {
      const withoutMessage = {
        success: true,
        token: 'token-123',
        expiresAt: '2024-12-31T23:59:59.000Z',
      };

      const result = ArticleAccessResponseSchema.safeParse(withoutMessage);
      expect(result.success).toBe(true);
    });

    it('should validate expiresAt as optional', () => {
      const withoutExpiresAt = {
        success: true,
        token: 'token-123',
        message: 'Success',
      };

      const result = ArticleAccessResponseSchema.safeParse(withoutExpiresAt);
      expect(result.success).toBe(true);
    });

    it('should accept valid ISO date string for expiresAt', () => {
      const validResponse = {
        success: true,
        expiresAt: '2024-01-01T00:00:00.000Z',
      };

      const result = ArticleAccessResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should validate success as boolean', () => {
      const trueSuccess = { success: true };
      const falseSuccess = { success: false };

      expect(ArticleAccessResponseSchema.safeParse(trueSuccess).success).toBe(true);
      expect(ArticleAccessResponseSchema.safeParse(falseSuccess).success).toBe(true);
    });

    it('should reject non-boolean success', () => {
      const invalidSuccess = {
        success: 'true', // string instead of boolean
      };

      const result = ArticleAccessResponseSchema.safeParse(invalidSuccess);
      expect(result.success).toBe(false);
    });

    it('should reject non-string token', () => {
      const invalidToken = {
        success: true,
        token: 12345, // number instead of string
      };

      const result = ArticleAccessResponseSchema.safeParse(invalidToken);
      expect(result.success).toBe(false);
    });

    it('should reject non-string message', () => {
      const invalidMessage = {
        success: true,
        message: { text: 'error' }, // object instead of string
      };

      const result = ArticleAccessResponseSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should reject non-string expiresAt', () => {
      const invalidExpiresAt = {
        success: true,
        expiresAt: new Date(), // Date object instead of string
      };

      const result = ArticleAccessResponseSchema.safeParse(invalidExpiresAt);
      expect(result.success).toBe(false);
    });
  });
});
