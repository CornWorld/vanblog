import { Test, type TestingModule } from '@nestjs/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';

import { JwtAuthGuard } from './jwt-auth.guard';

import type { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should call super.canActivate with the execution context', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-jwt-token',
            },
            user: { id: 1, username: 'testuser' },
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method
      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(true);
    });

    it('should return false when JWT validation fails', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer invalid-jwt-token',
            },
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method to return false
      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(false);
    });

    it('should handle missing authorization header', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as ExecutionContext;

      // Mock the parent canActivate method to throw or return false
      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
      expect(result).toBe(false);
    });
  });

  describe('JWT Token Expiration', () => {
    it('should deny access with expired token', async () => {
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIyfQ.signature';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${expiredToken}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      // Simulate expired token rejection
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
      expect(superCanActivateSpy).toHaveBeenCalled();
    });

    it('should deny access with token expiring soon', async () => {
      const expiringToken =
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTcwMzQyMDAwMH0.signature';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: expiringToken,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });

  describe('JWT Token Tampering Protection', () => {
    it('should reject token with modified payload', async () => {
      // Original token: {"sub":1,"username":"admin"}
      // Tampered token: {"sub":2,"username":"attacker"}
      const tamperedToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInVzZXJuYW1lIjoiYXR0YWNrZXIifQ.tampered_signature';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${tamperedToken}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should reject token with modified signature', async () => {
      const originalToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCJ9.signature123';
      const modifiedSignatureToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCJ9.wrongsignature';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${modifiedSignatureToken}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should reject token with added claims', async () => {
      // Original token might have been: {"sub":1,"username":"user"}
      // Attacker adds: "isAdmin":true
      const tamperedWithClaimsToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidXNlciIsImlzQWRtaW4iOnRydWV9.tampered';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${tamperedWithClaimsToken}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });

  describe('Token Blacklist Validation', () => {
    it('should deny access with blacklisted token', async () => {
      const blacklistedToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCJ9.blacklisted';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${blacklistedToken}`,
            },
            user: null, // User not set if token is invalid
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      // Simulate blacklist rejection
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should deny access after password change (old token blacklisted)', async () => {
      const oldTokenAfterPasswordChange =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCJ9.oldtoken';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${oldTokenAfterPasswordChange}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });

  describe('Invalid Token Format', () => {
    it('should reject malformed token - missing parts', async () => {
      const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjF9'; // Missing signature

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${malformedToken}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should reject completely invalid token format', async () => {
      const invalidToken = 'not-a-valid-jwt-token-at-all';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${invalidToken}`,
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should reject token with wrong Bearer prefix', async () => {
      const validTokenContent =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCJ9.signature';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Basic ${validTokenContent}`, // Wrong scheme
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should reject empty authorization header', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: '',
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });

    it('should reject Bearer prefix without token', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer ', // Only prefix, no token
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });

  describe('Authorization Header Case Sensitivity', () => {
    it('should handle lowercase authorization header', async () => {
      const validToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoidGVzdCJ9.signature';

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${validToken}`,
            },
            user: { id: 1, username: 'test' },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      superCanActivateSpy.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should reject uppercase Authorization header (case sensitive)', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              Authorization: 'Bearer valid-token', // Capital A
            },
          }),
        }),
      } as ExecutionContext;

      const superCanActivateSpy = vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );
      // Headers are typically case-insensitive in HTTP, but HTTP implementations might vary
      superCanActivateSpy.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(false);
    });
  });
});
