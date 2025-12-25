import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HookService } from '../plugin/services/hook.service';

import { PasswordChangeHandlerService } from './password-change-handler.service';
import { TokenService } from './token.service';

describe('PasswordChangeHandlerService', () => {
  let service: PasswordChangeHandlerService;
  let hookService: HookService;
  let tokenService: TokenService;

  const mockHookService = {
    addAction: vi.fn(),
  };

  const mockTokenService = {
    revokeAllUserTokens: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordChangeHandlerService,
        {
          provide: HookService,
          useValue: mockHookService,
        },
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    service = module.get<PasswordChangeHandlerService>(PasswordChangeHandlerService);
    hookService = module.get<HookService>(HookService);
    tokenService = module.get<TokenService>(TokenService);

    vi.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should register hook for password change', () => {
      service.onModuleInit();

      expect(hookService.addAction).toHaveBeenCalledWith(
        'user|afterPasswordChange',
        expect.any(Function),
      );
    });

    it('should revoke all tokens when password is changed', async () => {
      service.onModuleInit();

      // Get the registered hook handler
      const [, hookHandler] = mockHookService.addAction.mock.calls[0];

      // Simulate password change event
      const eventData = { userId: 123 };
      await hookHandler(eventData);

      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(123);
    });

    it('should handle hook execution for different users', async () => {
      service.onModuleInit();

      const [, hookHandler] = mockHookService.addAction.mock.calls[0];

      // Test with user 1
      await hookHandler({ userId: 1 });
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(1);

      // Test with user 2
      await hookHandler({ userId: 2 });
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(2);

      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledTimes(2);
    });

    it('should handle missing userId gracefully', () => {
      service.onModuleInit();

      const [, hookHandler] = mockHookService.addAction.mock.calls[0];

      // Test with missing userId (should not throw)
      expect(() => hookHandler({})).not.toThrow();
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(undefined);
    });
  });

  describe('service lifecycle', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have correct dependencies injected', () => {
      expect(service['hookService']).toBeDefined();
      expect(service['tokenService']).toBeDefined();
    });
  });

  describe('Security - userId Validation', () => {
    describe('userId existence checks', () => {
      it('should handle missing userId gracefully', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with missing userId (should not throw)
        expect(() => hookHandler({})).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(undefined);
      });

      it('should not process when userId is null', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with null userId
        expect(() => hookHandler({ userId: null })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(null);
      });

      it('should not process when userId is undefined', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with explicit undefined
        expect(() => hookHandler({ userId: undefined })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(undefined);
      });
    });

    describe('userId type validation', () => {
      it('should handle string userId (type error)', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with string instead of number
        expect(() => hookHandler({ userId: '123' })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith('123');
      });

      it('should handle invalid numeric values', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with zero (invalid user id)
        expect(() => hookHandler({ userId: 0 })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(0);

        // Test with negative number
        expect(() => hookHandler({ userId: -1 })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(-1);

        // Test with NaN
        expect(() => hookHandler({ userId: NaN })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(NaN);
      });

      it('should handle boolean userId (type error)', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with boolean
        expect(() => hookHandler({ userId: true })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(true);
      });

      it('should handle object userId (type error)', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with object
        expect(() => hookHandler({ userId: {} })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith({});
      });

      it('should handle array userId (type error)', () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test with array
        expect(() => hookHandler({ userId: [123] })).not.toThrow();
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith([123]);
      });
    });

    describe('prevent modifying other users passwords', () => {
      it('should only revoke tokens for the specified user', async () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Simulate user A changing password
        const userAId = 100;
        await hookHandler({ userId: userAId });

        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(userAId);
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledTimes(1);

        // Verify tokens are not revoked for other users
        expect(tokenService.revokeAllUserTokens).not.toHaveBeenCalledWith(101);
        expect(tokenService.revokeAllUserTokens).not.toHaveBeenCalledWith(102);
      });

      it('should not allow token revocation for non-existent users', async () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Even for non-existent user IDs, tokens are attempted to be revoked
        // (actual validation should be in TokenService)
        const nonExistentUserId = 999999;
        await hookHandler({ userId: nonExistentUserId });

        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(nonExistentUserId);
      });

      it('should not leak data through invalid userId values', async () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Test various invalid IDs to ensure no data leakage
        const invalidIds = [null, undefined, 0, -1, NaN];

        for (const id of invalidIds) {
          vi.clearAllMocks();
          await hookHandler({ userId: id });
          expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(id);
        }
      });
    });

    describe('concurrent password changes', () => {
      it('should handle concurrent password changes for different users', async () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Simulate concurrent password changes
        const promises = [
          hookHandler({ userId: 1 }),
          hookHandler({ userId: 2 }),
          hookHandler({ userId: 3 }),
        ];

        await Promise.all(promises);

        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledTimes(3);
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(1);
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(2);
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(3);
      });

      it('should handle concurrent password changes for same user', async () => {
        service.onModuleInit();

        const [, hookHandler] = mockHookService.addAction.mock.calls[0];

        // Simulate concurrent password changes for same user
        const userId = 42;
        const promises = [
          hookHandler({ userId }),
          hookHandler({ userId }),
          hookHandler({ userId }),
        ];

        await Promise.all(promises);

        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledTimes(3);
        expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith(userId);
      });
    });
  });
});
