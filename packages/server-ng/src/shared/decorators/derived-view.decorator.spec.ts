import { describe, it, expect } from 'vitest';
import { DerivedView, DERIVED_VIEW_METADATA, DerivedViewOptions } from './derived-view.decorator';
import { Reflector } from '@nestjs/core';

describe('DerivedView Decorator', () => {
  describe('DERIVED_VIEW_METADATA', () => {
    it('should export the metadata key', () => {
      expect(DERIVED_VIEW_METADATA).toBe('derived-view');
    });
  });

  describe('DerivedView', () => {
    class TestController {
      @DerivedView({ key: 'test:key' })
      getTestData(): { data: string } {
        return { data: 'test' };
      }

      @DerivedView({
        key: 'custom:key',
        ttl: 600,
        swr: false,
        swrTolerance: 120,
      })
      getCustomData(): { data: string } {
        return { data: 'custom' };
      }

      @DerivedView({
        key: 'minimal:key',
      })
      getMinimalData(): { data: string } {
        return { data: 'minimal' };
      }
    }

    const reflector = new Reflector();

    it('should attach metadata to method with default options', () => {
      const metadata = reflector.get<DerivedViewOptions>(
        DERIVED_VIEW_METADATA,
        TestController.prototype.getTestData,
      );

      expect(metadata).toBeDefined();
      expect(metadata.key).toBe('test:key');
      expect(metadata.ttl).toBeUndefined();
      expect(metadata.swr).toBeUndefined();
      expect(metadata.swrTolerance).toBeUndefined();
    });

    it('should attach metadata with all custom options', () => {
      const metadata = reflector.get<DerivedViewOptions>(
        DERIVED_VIEW_METADATA,
        TestController.prototype.getCustomData,
      );

      expect(metadata).toBeDefined();
      expect(metadata.key).toBe('custom:key');
      expect(metadata.ttl).toBe(600);
      expect(metadata.swr).toBe(false);
      expect(metadata.swrTolerance).toBe(120);
    });

    it('should work with minimal configuration', () => {
      const metadata = reflector.get<DerivedViewOptions>(
        DERIVED_VIEW_METADATA,
        TestController.prototype.getMinimalData,
      );

      expect(metadata).toBeDefined();
      expect(metadata.key).toBe('minimal:key');
    });

    it('should return a MethodDecorator', () => {
      const decorator = DerivedView({ key: 'test' });
      expect(typeof decorator).toBe('function');
    });

    it('should not interfere with method execution', () => {
      const controller = new TestController();
      const result = controller.getTestData();
      expect(result).toEqual({ data: 'test' });
    });

    it('should allow multiple decorators on same class', () => {
      const metadata1 = reflector.get<DerivedViewOptions>(
        DERIVED_VIEW_METADATA,
        TestController.prototype.getTestData,
      );
      const metadata2 = reflector.get<DerivedViewOptions>(
        DERIVED_VIEW_METADATA,
        TestController.prototype.getCustomData,
      );
      const metadata3 = reflector.get<DerivedViewOptions>(
        DERIVED_VIEW_METADATA,
        TestController.prototype.getMinimalData,
      );

      expect(metadata1.key).toBe('test:key');
      expect(metadata2.key).toBe('custom:key');
      expect(metadata3.key).toBe('minimal:key');
    });

    it('should preserve method properties', () => {
      const method = TestController.prototype.getTestData;
      expect(method.name).toBe('getTestData');
      expect(typeof method).toBe('function');
    });
  });

  describe('DerivedViewOptions interface', () => {
    it('should accept valid options', () => {
      const options: DerivedViewOptions = {
        key: 'valid:key',
        ttl: 300,
        swr: true,
        swrTolerance: 60,
      };

      expect(options.key).toBe('valid:key');
      expect(options.ttl).toBe(300);
      expect(options.swr).toBe(true);
      expect(options.swrTolerance).toBe(60);
    });

    it('should accept minimal options', () => {
      const options: DerivedViewOptions = {
        key: 'minimal:key',
      };

      expect(options.key).toBe('minimal:key');
      expect(options.ttl).toBeUndefined();
    });

    it('should accept partial options', () => {
      const options1: DerivedViewOptions = {
        key: 'key1',
        ttl: 500,
      };

      const options2: DerivedViewOptions = {
        key: 'key2',
        swr: false,
      };

      expect(options1.ttl).toBe(500);
      expect(options2.swr).toBe(false);
    });
  });

  describe('Integration with NestJS', () => {
    it('should work with SetMetadata', () => {
      class ExampleController {
        @DerivedView({
          key: 'example:data',
          ttl: 300,
          swr: true,
          swrTolerance: 60,
        })
        getData(): { result: string } {
          return { result: 'example' };
        }
      }

      const reflector = new Reflector();
      const metadata = reflector.get(DERIVED_VIEW_METADATA, ExampleController.prototype.getData);

      expect(metadata).toBeDefined();
      expect(metadata).toMatchObject({
        key: 'example:data',
        ttl: 300,
        swr: true,
        swrTolerance: 60,
      });
    });
  });
});
