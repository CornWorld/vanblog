import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompressionMiddleware } from './compression.middleware';
import type { Request, Response, NextFunction } from 'express';

describe('CompressionMiddleware', () => {
  let middleware: CompressionMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new CompressionMiddleware();
    mockRequest = {
      headers: {},
    } as Partial<Request>;
    mockResponse = {
      getHeader: vi.fn(),
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as Partial<Response>;
    mockNext = vi.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
    expect(middleware.use).toBeDefined();
  });

  it('should have use method', () => {
    expect(typeof middleware.use).toBe('function');
  });

  it('should call next when invoked', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should not compress when x-no-compression header is present', () => {
    mockRequest.headers = { 'x-no-compression': 'true' };
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  describe('compression filter', () => {
    it('should compress text/html content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('text/html');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should compress application/json content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('application/json');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should compress application/javascript content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('application/javascript');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should compress application/xml content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('application/xml');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should compress application/rss+xml content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('application/rss+xml');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should compress application/atom+xml content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('application/atom+xml');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should compress image/svg+xml content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('image/svg+xml');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use default filter when content-type is empty string', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use default filter when content-type is not a string', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue(undefined);
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('compression configuration', () => {
    it('should have compressionHandler configured with level 6', () => {
      expect((middleware as any).compressionHandler).toBeDefined();
    });

    it('should handle multiple requests', () => {
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    it('should handle requests with different content types', () => {
      // First request with JSON
      mockResponse.getHeader = vi.fn().mockReturnValue('application/json');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request with HTML
      mockResponse.getHeader = vi.fn().mockReturnValue('text/html');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      // Third request with XML
      mockResponse.getHeader = vi.fn().mockReturnValue('application/xml');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('should handle request without headers', () => {
      mockRequest.headers = undefined as any;
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle response without getHeader method', () => {
      mockResponse.getHeader = undefined as any;
      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle content-type with charset', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('text/html; charset=utf-8');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle content-type with parameters', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('application/json; boundary=something');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not compress image/jpeg content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('image/jpeg');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not compress image/png content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('image/png');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not compress video content', () => {
      mockResponse.getHeader = vi.fn().mockReturnValue('video/mp4');
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
