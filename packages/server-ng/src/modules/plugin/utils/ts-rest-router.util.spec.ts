/**
 * @file ts-rest-router.util.spec.ts
 *
 * 测试 ts-rest 契约路由匹配与执行工具
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  pathToRegex,
  matchPath,
  extractRoutes,
  matchContractRoute,
  executeContractHandler,
  TsRestRouter,
  type RequestData,
} from './ts-rest-router.util';

// Mock logger
vi.mock('@nestjs/common', () => ({
  Logger: class {
    debug = vi.fn();
    log = vi.fn();
    error = vi.fn();
  },
}));

describe('ts-rest Router Util', () => {
  describe('pathToRegex', () => {
    it('should convert static path to regex', () => {
      const { regex, paramNames } = pathToRegex('/books');

      expect(regex.test('/books')).toBe(true);
      expect(regex.test('/books/123')).toBe(false);
      expect(paramNames).toEqual([]);
    });

    it('should convert path with single parameter', () => {
      const { regex, paramNames } = pathToRegex('/books/:id');

      expect(regex.test('/books/123')).toBe(true);
      expect(regex.test('/books/abc')).toBe(true);
      expect(regex.test('/books')).toBe(false);
      expect(regex.test('/books/123/reviews')).toBe(false);
      expect(paramNames).toEqual(['id']);
    });

    it('should convert path with multiple parameters', () => {
      const { regex, paramNames } = pathToRegex('/books/:id/reviews/:reviewId');

      expect(regex.test('/books/123/reviews/456')).toBe(true);
      expect(regex.test('/books/abc/reviews/xyz')).toBe(true);
      expect(regex.test('/books/123')).toBe(false);
      expect(paramNames).toEqual(['id', 'reviewId']);
    });

    it('should handle root path', () => {
      const { regex, paramNames } = pathToRegex('/');

      expect(regex.test('/')).toBe(true);
      expect(regex.test('/books')).toBe(false);
      expect(paramNames).toEqual([]);
    });
  });

  describe('matchPath', () => {
    it('should match static path', () => {
      const params = matchPath('/books', '/books');

      expect(params).toEqual({});
    });

    it('should return null for non-matching path', () => {
      const params = matchPath('/books', '/articles');

      expect(params).toBeNull();
    });

    it('should extract single parameter', () => {
      const params = matchPath('/books/123', '/books/:id');

      expect(params).toEqual({ id: '123' });
    });

    it('should extract multiple parameters', () => {
      const params = matchPath('/books/123/reviews/456', '/books/:id/reviews/:reviewId');

      expect(params).toEqual({
        id: '123',
        reviewId: '456',
      });
    });

    it('should handle alphanumeric parameters', () => {
      const params = matchPath('/users/john-doe', '/users/:username');

      expect(params).toEqual({ username: 'john-doe' });
    });

    it('should not match partial paths', () => {
      const params = matchPath('/books/123/extra', '/books/:id');

      expect(params).toBeNull();
    });
  });

  describe('extractRoutes', () => {
    it('should extract routes from flat contract', () => {
      const contract = initContract().router({
        getBooks: {
          method: 'GET',
          path: '/books',
          responses: {
            200: z.array(z.object({ id: z.number() })),
          },
        },
        getBook: {
          method: 'GET',
          path: '/books/:id',
          responses: {
            200: z.object({ id: z.number() }),
          },
        },
      });

      const routes = extractRoutes(contract);

      expect(routes).toHaveLength(2);
      expect(routes[0].key).toBe('getBooks');
      expect(routes[0].route.path).toBe('/books');
      expect(routes[1].key).toBe('getBook');
      expect(routes[1].route.path).toBe('/books/:id');
    });

    it('should extract routes from nested contract', () => {
      const contract = initContract().router({
        books: {
          list: {
            method: 'GET',
            path: '/books',
            responses: {
              200: z.array(z.object({ id: z.number() })),
            },
          },
          get: {
            method: 'GET',
            path: '/books/:id',
            responses: {
              200: z.object({ id: z.number() }),
            },
          },
        },
      });

      const routes = extractRoutes(contract);

      expect(routes).toHaveLength(2);
      expect(routes.some((r) => r.key === 'books.list')).toBe(true);
      expect(routes.some((r) => r.key === 'books.get')).toBe(true);
    });

    it('should handle empty contract', () => {
      const contract = initContract().router({});

      const routes = extractRoutes(contract);

      expect(routes).toEqual([]);
    });
  });

  describe('matchContractRoute', () => {
    let contract: any;

    beforeEach(() => {
      contract = initContract().router({
        getBooks: {
          method: 'GET',
          path: '/books',
          responses: {
            200: z.array(z.object({ id: z.number() })),
          },
        },
        getBook: {
          method: 'GET',
          path: '/books/:id',
          responses: {
            200: z.object({ id: z.number() }),
          },
        },
        createBook: {
          method: 'POST',
          path: '/books',
          body: z.object({ title: z.string() }),
          responses: {
            201: z.object({ id: z.number() }),
          },
        },
      });
    });

    it('should match GET request to /books', () => {
      const match = matchContractRoute(contract, 'GET', '/books');

      expect(match).toBeDefined();
      expect(match?.routeKey).toBe('getBooks');
      expect(match?.params).toEqual({});
    });

    it('should match GET request with parameter', () => {
      const match = matchContractRoute(contract, 'GET', '/books/123');

      expect(match).toBeDefined();
      expect(match?.routeKey).toBe('getBook');
      expect(match?.params).toEqual({ id: '123' });
    });

    it('should match based on HTTP method', () => {
      const match = matchContractRoute(contract, 'POST', '/books');

      expect(match).toBeDefined();
      expect(match?.routeKey).toBe('createBook');
    });

    it('should return null for non-matching path', () => {
      const match = matchContractRoute(contract, 'GET', '/articles');

      expect(match).toBeNull();
    });

    it('should return null for non-matching method', () => {
      const match = matchContractRoute(contract, 'DELETE', '/books');

      expect(match).toBeNull();
    });

    it('should be case-insensitive for methods', () => {
      const match1 = matchContractRoute(contract, 'get', '/books');
      const match2 = matchContractRoute(contract, 'GET', '/books');

      expect(match1?.routeKey).toBe(match2?.routeKey);
    });
  });

  describe('executeContractHandler', () => {
    it('should execute handler and return response', async () => {
      const handler = vi.fn().mockResolvedValue({
        status: 200,
        body: { message: 'Success' },
      });

      const requestData: RequestData = {
        params: { id: '123' },
        query: {},
        body: null,
        headers: {},
      };

      const response = await executeContractHandler(handler, requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Success' });
      expect(handler).toHaveBeenCalledWith(requestData);
    });

    it('should pass all request data to handler', async () => {
      const handler = vi.fn().mockResolvedValue({
        status: 200,
        body: {},
      });

      const requestData: RequestData = {
        params: { id: '123' },
        query: { page: '1' },
        body: { title: 'Test' },
        headers: { 'content-type': 'application/json' },
      };

      await executeContractHandler(handler, requestData);

      expect(handler).toHaveBeenCalledWith({
        params: { id: '123' },
        query: { page: '1' },
        body: { title: 'Test' },
        headers: { 'content-type': 'application/json' },
      });
    });

    it('should return 500 on handler error', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await executeContractHandler(handler, requestData);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal Server Error');
      expect(response.body.error).toBe('Handler failed');
    });

    it('should handle non-Error exceptions', async () => {
      const handler = vi.fn().mockRejectedValue('String error');

      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await executeContractHandler(handler, requestData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unknown error');
    });
  });

  describe('TsRestRouter', () => {
    let contract: any;
    let handlers: any;
    let router: TsRestRouter;

    beforeEach(() => {
      contract = initContract().router({
        getBooks: {
          method: 'GET',
          path: '/books',
          responses: {
            200: z.array(z.object({ id: z.number() })),
          },
        },
        getBook: {
          method: 'GET',
          path: '/books/:id',
          responses: {
            200: z.object({ id: z.number() }),
          },
        },
      });

      handlers = {
        getBooks: vi.fn().mockResolvedValue({
          status: 200,
          body: [{ id: 1 }, { id: 2 }],
        }),
        getBook: vi.fn().mockResolvedValue({
          status: 200,
          body: { id: 1 },
        }),
      };

      router = new TsRestRouter('test-plugin', contract, handlers);
    });

    it('should handle request matching a route', async () => {
      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await router.handleRequest('GET', '/books', requestData);

      expect(response).toBeDefined();
      expect(response?.status).toBe(200);
      expect(response?.body).toEqual([{ id: 1 }, { id: 2 }]);
      expect(handlers.getBooks).toHaveBeenCalled();
    });

    it('should extract and pass path parameters', async () => {
      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await router.handleRequest('GET', '/books/123', requestData);

      expect(response).toBeDefined();
      expect(response?.status).toBe(200);
      expect(handlers.getBook).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: '123' },
        }),
      );
    });

    it('should merge path params with request params', async () => {
      const requestData: RequestData = {
        params: { other: 'value' },
        query: {},
        body: null,
        headers: {},
      };

      await router.handleRequest('GET', '/books/123', requestData);

      expect(handlers.getBook).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { other: 'value', id: '123' },
        }),
      );
    });

    it('should return null for non-matching route', async () => {
      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await router.handleRequest('GET', '/articles', requestData);

      expect(response).toBeNull();
    });

    it('should return 500 if handler not found', async () => {
      const contractWithMissingHandler = initContract().router({
        deleteBook: {
          method: 'DELETE',
          path: '/books/:id',
          responses: {
            204: z.undefined(),
          },
        },
      });

      const routerWithMissingHandler = new TsRestRouter(
        'test-plugin',
        contractWithMissingHandler,
        {},
      );

      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await routerWithMissingHandler.handleRequest(
        'DELETE',
        '/books/123',
        requestData,
      );

      expect(response).toBeDefined();
      expect(response?.status).toBe(500);
      expect(response?.body.error).toContain('Handler not found');
    });

    it('should list all routes', () => {
      const routes = router.listRoutes();

      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual({
        key: 'getBooks',
        method: 'GET',
        path: '/books',
      });
      expect(routes[1]).toEqual({
        key: 'getBook',
        method: 'GET',
        path: '/books/:id',
      });
    });

    it('should handle nested handlers', async () => {
      const nestedContract = initContract().router({
        user: {
          getProfile: {
            method: 'GET',
            path: '/user/profile',
            responses: {
              200: z.object({ name: z.string() }),
            },
          },
        },
      });

      const nestedHandlers = {
        user: {
          getProfile: vi.fn().mockResolvedValue({
            status: 200,
            body: { name: 'John' },
          }),
        },
      };

      const nestedRouter = new TsRestRouter('test-plugin', nestedContract, nestedHandlers);

      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await nestedRouter.handleRequest('GET', '/user/profile', requestData);

      expect(response).toBeDefined();
      expect(response?.status).toBe(200);
      expect(response?.body).toEqual({ name: 'John' });
    });

    it('should return 500 on handler execution error', async () => {
      handlers.getBooks.mockRejectedValue(new Error('Database error'));

      const requestData: RequestData = {
        params: {},
        query: {},
        body: null,
        headers: {},
      };

      const response = await router.handleRequest('GET', '/books', requestData);

      expect(response).toBeDefined();
      expect(response?.status).toBe(500);
      expect(response?.body.error).toBe('Database error');
    });
  });
});
