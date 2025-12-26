import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import * as jwt from 'jsonwebtoken';

import { ConfigService } from '../../../config/config.service';
import { ArticleService } from '../article.service';
import { ARTICLE_ACCESS_KEY } from '../decorators/article-access.decorator';
import { SKIP_ARTICLE_ACCESS_KEY } from '../decorators/skip-article-access.decorator';

import { ArticleAccessGuard } from './article-access.guard';

describe('ArticleAccessGuard', () => {
  let guard: ArticleAccessGuard;
  let reflector: Reflector;
  let articleService: Partial<ArticleService>;
  let configService: Partial<ConfigService>;

  const mockExecutionContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(request),
      }),
      getHandler: vi.fn().mockReturnValue(() => ({})),
      getClass: vi.fn().mockReturnValue({}),
    } as any;
  };

  beforeEach(async () => {
    articleService = {
      isPrivateById: vi.fn(),
      isPrivateByPathname: vi.fn(),
    };

    configService = {
      jwt: { secret: 'test-secret' },
    } as Partial<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleAccessGuard,
        Reflector,
        { provide: ArticleService, useValue: articleService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    guard = module.get<ArticleAccessGuard>(ArticleAccessGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('canActivate', () => {
    it('should allow access when SKIP_ARTICLE_ACCESS is set', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      const context = mockExecutionContext({ params: {} });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when ARTICLE_ACCESS is not required', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return false;
        return false;
      });

      const context = mockExecutionContext({ params: {} });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access for public article by ID', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(false);

      const context = mockExecutionContext({ params: { id: '1' } });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(articleService.isPrivateById).toHaveBeenCalledWith(1);
    });

    it('should allow access for public article by pathname', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateByPathname as any).mockResolvedValue(false);

      const context = mockExecutionContext({ params: { pathname: 'test-article' } });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(articleService.isPrivateByPathname).toHaveBeenCalledWith('test-article');
    });

    it('should return true when article not found by ID (let controller handle 404)', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(null);

      const context = mockExecutionContext({ params: { id: '999' } });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException when no token provided for private article', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const context = mockExecutionContext({
        params: { id: '1' },
        headers: {},
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Article access token required');
    });

    it('should allow access with valid token for private article', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        articleTitle: 'Test',
        pathname: 'test',
        type: 'article-access',
        userId: null,
        isAnonymous: true,
      };

      const token = jwt.sign(payload, 'test-secret');

      const request = {
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
      };

      const context = mockExecutionContext(request);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request).toHaveProperty('articleAccess');
      expect((request as any).articleAccess.articleId).toBe(1);
    });

    it('should throw UnauthorizedException for invalid token type', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        type: 'wrong-type',
        userId: null,
        isAnonymous: true,
      };

      const token = jwt.sign(payload, 'test-secret');

      const context = mockExecutionContext({
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      // The guard catches the error and throws a generic message
    });

    it('should throw UnauthorizedException when token is bound to different user', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        articleTitle: 'Test',
        pathname: 'test',
        type: 'article-access',
        userId: 123,
        isAnonymous: false,
      };

      const token = jwt.sign(payload, 'test-secret');

      const context = mockExecutionContext({
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
        user: { id: 456 }, // Different user
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      // The guard catches the error and throws a generic message
    });

    it('should allow access when token is bound to correct user', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        articleTitle: 'Test',
        pathname: 'test',
        type: 'article-access',
        userId: 123,
        isAnonymous: false,
      };

      const token = jwt.sign(payload, 'test-secret');

      const request = {
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
        user: { id: 123 }, // Same user
      };

      const context = mockExecutionContext(request);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect((request as any).articleAccess.userId).toBe(123);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        articleTitle: 'Test',
        pathname: 'test',
        type: 'article-access',
        userId: null,
        isAnonymous: true,
      };

      // Create an expired token (expired 1 hour ago)
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '-1h' });

      const context = mockExecutionContext({
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid or expired access token');
    });

    it('should throw UnauthorizedException for token with exp=0', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        articleTitle: 'Test',
        pathname: 'test',
        type: 'article-access',
        userId: null,
        isAnonymous: true,
        exp: 0, // exp=0 means already expired
      };

      const token = jwt.sign(payload, 'test-secret', { noTimestamp: true });

      const context = mockExecutionContext({
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for token signed with wrong secret', async () => {
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_ARTICLE_ACCESS_KEY) return false;
        if (key === ARTICLE_ACCESS_KEY) return true;
        return false;
      });

      (articleService.isPrivateById as any).mockResolvedValue(true);

      const payload = {
        articleId: 1,
        articleTitle: 'Test',
        pathname: 'test',
        type: 'article-access',
        userId: null,
        isAnonymous: true,
      };

      // Sign with wrong secret
      const token = jwt.sign(payload, 'wrong-secret');

      const context = mockExecutionContext({
        params: { id: '1' },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
