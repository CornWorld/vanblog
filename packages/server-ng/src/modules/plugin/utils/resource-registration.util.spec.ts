/**
 * @file resource-registration.util.spec.ts
 *
 * 声明式资源注册测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { registerResource, type ResourceRegistrationContext } from './resource-registration.util';

// Mock logger
vi.mock('@nestjs/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Logger: class {
      log = vi.fn();
      debug = vi.fn();
      info = vi.fn();
      warn = vi.fn();
      error = vi.fn();
    },
  };
});

describe('Resource Registration', () => {
  let mockDb: any;
  let mockHttpRegistry: any;
  let context: ResourceRegistrationContext;

  beforeEach(() => {
    // Create a more sophisticated database mock that handles the query pattern
    // db.select().from(table).limit().offset() which returns a Promise
    const createResolvableChain = (data: any[]) => {
      const chain: any = {
        where: vi.fn(),
        limit: vi.fn(),
        offset: vi.fn(),
        orderBy: vi.fn(),
        groupBy: vi.fn(),
        then: (resolve: any) => Promise.resolve(data).then(resolve),
      };

      // Make all methods return the chain for chaining
      chain.where.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      chain.offset.mockReturnValue(chain);
      chain.orderBy.mockReturnValue(chain);
      chain.groupBy.mockReturnValue(chain);

      return chain;
    };

    mockDb = {
      select: vi.fn().mockImplementation((fields?: any) => {
        const fromMock = vi.fn().mockImplementation(() => {
          if (fields && 'count' in fields) {
            // COUNT query
            return createResolvableChain([{ count: 2 }]);
          }
          // Regular SELECT query
          return createResolvableChain([
            { id: 1, title: 'Book 1' },
            { id: 2, title: 'Book 2' },
          ]);
        });
        return { from: fromMock };
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1, title: 'New Book' }]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Updated Book' }]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    };

    // Mock HTTP registry
    mockHttpRegistry = {
      registerRawRoute: vi.fn(),
    };

    // Mock table
    const mockTable = {
      [Symbol.for('drizzle:Table')]: {
        columns: [],
      },
      id: { name: 'id' },
    };

    // Create context
    context = {
      pluginId: 'test-plugin',
      resourceName: 'books',
      table: mockTable as any,
      schema: z.object({
        id: z.number(),
        title: z.string(),
        author: z.string().optional(),
      }),
      db: mockDb,
      httpRegistry: mockHttpRegistry,
    };
  });

  describe('registerResource', () => {
    it('should register all CRUD endpoints by default', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      // Should register 5 endpoints: LIST, GET, CREATE, UPDATE, DELETE
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledTimes(5);

      // Verify endpoint registrations
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'GET',
        '/books',
        expect.any(Function),
      );
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'GET',
        '/books/:id',
        expect.any(Function),
      );
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'POST',
        '/books',
        expect.any(Function),
      );
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'PATCH',
        '/books/:id',
        expect.any(Function),
      );
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'DELETE',
        '/books/:id',
        expect.any(Function),
      );
    });

    it('should respect endpoint configuration', async () => {
      await registerResource(context, {
        schema: context.schema,
        endpoints: {
          list: true,
          get: true,
          create: false,
          update: false,
          delete: false,
        },
      });

      // Should only register LIST and GET
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledTimes(2);
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'GET',
        '/books',
        expect.any(Function),
      );
      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalledWith(
        'test-plugin',
        'GET',
        '/books/:id',
        expect.any(Function),
      );
    });

    it('should register hooks', async () => {
      const beforeCreate = vi.fn((data) => data);
      const afterCreate = vi.fn();

      await registerResource(context, {
        schema: context.schema,
        hooks: {
          beforeCreate,
          afterCreate,
        },
      });

      expect(mockHttpRegistry.registerRawRoute).toHaveBeenCalled();
    });
  });

  describe('LIST Handler', () => {
    it('should handle list requests with pagination', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      // Get the LIST handler
      const listHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'GET' && call[2] === '/books',
      )[3];

      const mockReq = {
        query: { page: '1', limit: '10' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await listHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.any(Array),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
          }),
        }),
      );
    });

    it('should use default pagination values', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      const listHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'GET' && call[2] === '/books',
      )[3];

      const mockReq = {
        query: {},
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await listHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1,
            limit: 20, // default
          }),
        }),
      );
    });
  });

  describe('GET Handler', () => {
    it('should handle get requests', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      const getHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'GET' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: '1' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await getHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'Book 1',
        }),
      );
    });

    it('should return 404 when resource not found', async () => {
      // Override select mock for this test to return empty
      mockDb.select.mockImplementation((_fields?: any) => {
        const fromMock = vi.fn().mockImplementation(() => {
          const chain: any = {
            where: vi.fn(),
            limit: vi.fn(),
            offset: vi.fn(),
            orderBy: vi.fn(),
            groupBy: vi.fn(),
            then: (resolve: any) => Promise.resolve([]).then(resolve),
          };

          // Make all methods return the chain for chaining
          chain.where.mockReturnValue(chain);
          chain.limit.mockReturnValue(chain);
          chain.offset.mockReturnValue(chain);
          chain.orderBy.mockReturnValue(chain);
          chain.groupBy.mockReturnValue(chain);

          return chain;
        });
        return { from: fromMock };
      });

      await registerResource(context, {
        schema: context.schema,
      });

      const getHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'GET' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: '999' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await getHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not Found' });
    });

    it('should return 400 for invalid ID', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      const getHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'GET' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: 'invalid' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await getHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid ID' });
    });
  });

  describe('CREATE Handler', () => {
    it('should handle create requests', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      const createHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'POST' && call[2] === '/books',
      )[3];

      const mockReq = {
        body: { id: 1, title: 'New Book', author: 'Test Author' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await createHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'New Book',
        }),
      );
    });

    it('should call beforeCreate hook', async () => {
      const beforeCreate = vi.fn((data) => ({ ...data, title: 'Modified' }));

      await registerResource(context, {
        schema: context.schema,
        hooks: { beforeCreate },
      });

      const createHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'POST' && call[2] === '/books',
      )[3];

      const mockReq = {
        body: { id: 1, title: 'Original', author: 'Test' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await createHandler(mockReq, mockRes);

      expect(beforeCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Original' }));
    });

    it('should call afterCreate hook', async () => {
      const afterCreate = vi.fn();

      await registerResource(context, {
        schema: context.schema,
        hooks: { afterCreate },
      });

      const createHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'POST' && call[2] === '/books',
      )[3];

      const mockReq = {
        body: { id: 1, title: 'New Book' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await createHandler(mockReq, mockRes);

      expect(afterCreate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, title: 'New Book' }),
      );
    });
  });

  describe('UPDATE Handler', () => {
    it('should handle update requests', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      const updateHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'PATCH' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: '1' },
        body: { title: 'Updated Title' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await updateHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'Updated Book',
        }),
      );
    });

    it('should call beforeUpdate and afterUpdate hooks', async () => {
      const beforeUpdate = vi.fn((_id, data) => data);
      const afterUpdate = vi.fn();

      await registerResource(context, {
        schema: context.schema,
        hooks: { beforeUpdate, afterUpdate },
      });

      const updateHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'PATCH' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: '1' },
        body: { title: 'Updated' },
      };
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      };

      await updateHandler(mockReq, mockRes);

      expect(beforeUpdate).toHaveBeenCalledWith(1, expect.any(Object));
      expect(afterUpdate).toHaveBeenCalled();
    });
  });

  describe('DELETE Handler', () => {
    it('should handle delete requests', async () => {
      await registerResource(context, {
        schema: context.schema,
      });

      const deleteHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'DELETE' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: '1' },
      };
      const mockRes = {
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await deleteHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should call beforeDelete and afterDelete hooks', async () => {
      const beforeDelete = vi.fn();
      const afterDelete = vi.fn();

      await registerResource(context, {
        schema: context.schema,
        hooks: { beforeDelete, afterDelete },
      });

      const deleteHandler = mockHttpRegistry.registerRawRoute.mock.calls.find(
        (call: any) => call[1] === 'DELETE' && call[2] === '/books/:id',
      )[3];

      const mockReq = {
        params: { id: '1' },
      };
      const mockRes = {
        send: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await deleteHandler(mockReq, mockRes);

      expect(beforeDelete).toHaveBeenCalledWith(1);
      expect(afterDelete).toHaveBeenCalledWith(1);
    });
  });
});
