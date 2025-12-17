/**
 * @file plugin-service-registry.service.spec.ts
 *
 * 单元测试 - 插件服务注册表
 */

import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injectable } from '@nestjs/common';
import { PluginServiceRegistryService } from './plugin-service-registry.service';

// Test service classes
@Injectable()
class TestService {
  private value = 0;

  getValue() {
    return this.value;
  }

  increment() {
    this.value++;
    return this.value;
  }
}

@Injectable()
class AnotherService {
  getName() {
    return 'AnotherService';
  }
}

describe('PluginServiceRegistryService', () => {
  let service: PluginServiceRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginServiceRegistryService],
    }).compile();

    service = module.get<PluginServiceRegistryService>(PluginServiceRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerService', () => {
    it('should register a singleton service', () => {
      const instance = new TestService();

      service.registerService('test-plugin', TestService, instance, 'singleton');

      const retrieved = service.getService('test-plugin', TestService);
      expect(retrieved).toBe(instance);
    });

    it('should register a transient service', () => {
      const instance = new TestService();

      service.registerService('test-plugin', TestService, instance, 'transient');

      // Transient should return new instances
      const retrieved1 = service.getService('test-plugin', TestService);
      const retrieved2 = service.getService('test-plugin', TestService);

      expect(retrieved1).not.toBe(retrieved2);
      expect(retrieved1).toBeInstanceOf(TestService);
      expect(retrieved2).toBeInstanceOf(TestService);
    });

    it('should default to singleton scope', () => {
      const instance = new TestService();

      service.registerService('test-plugin', TestService, instance);

      const retrieved1 = service.getService('test-plugin', TestService);
      const retrieved2 = service.getService('test-plugin', TestService);

      expect(retrieved1).toBe(retrieved2);
      expect(retrieved1).toBe(instance);
    });

    it('should allow multiple services for the same plugin', () => {
      const testInstance = new TestService();
      const anotherInstance = new AnotherService();

      service.registerService('test-plugin', TestService, testInstance, 'singleton');
      service.registerService('test-plugin', AnotherService, anotherInstance, 'singleton');

      expect(service.getService('test-plugin', TestService)).toBe(testInstance);
      expect(service.getService('test-plugin', AnotherService)).toBe(anotherInstance);
    });

    it('should overwrite existing service with warning', () => {
      const instance1 = new TestService();
      const instance2 = new TestService();

      service.registerService('test-plugin', TestService, instance1, 'singleton');
      service.registerService('test-plugin', TestService, instance2, 'singleton');

      const retrieved = service.getService('test-plugin', TestService);
      expect(retrieved).toBe(instance2);
    });
  });

  describe('getService', () => {
    it('should return singleton instance', () => {
      const instance = new TestService();
      service.registerService('test-plugin', TestService, instance, 'singleton');

      const retrieved = service.getService('test-plugin', TestService);

      expect(retrieved).toBe(instance);
      expect(retrieved?.getValue()).toBe(0);
    });

    it('should return new instances for transient services', () => {
      const instance = new TestService();
      service.registerService('test-plugin', TestService, instance, 'transient');

      const retrieved1 = service.getService('test-plugin', TestService);
      const retrieved2 = service.getService('test-plugin', TestService);

      // Each retrieval should return a new instance
      expect(retrieved1).not.toBe(retrieved2);
      expect(retrieved1).toBeInstanceOf(TestService);
      expect(retrieved2).toBeInstanceOf(TestService);

      // Verify they are independent instances
      retrieved1?.increment();
      expect(retrieved1?.getValue()).toBe(1);
      expect(retrieved2?.getValue()).toBe(0); // Still 0
    });

    it('should return null when service does not exist', () => {
      const retrieved = service.getService('nonexistent-plugin', TestService);

      expect(retrieved).toBeNull();
    });

    it('should support multiple plugins with same service class', () => {
      const instance1 = new TestService();
      const instance2 = new TestService();

      service.registerService('plugin-a', TestService, instance1, 'singleton');
      service.registerService('plugin-b', TestService, instance2, 'singleton');

      const retrieved1 = service.getService('plugin-a', TestService);
      const retrieved2 = service.getService('plugin-b', TestService);

      expect(retrieved1).toBe(instance1);
      expect(retrieved2).toBe(instance2);
      expect(retrieved1).not.toBe(retrieved2);
    });
  });

  describe('hasService', () => {
    it('should return true when service exists', () => {
      const instance = new TestService();
      service.registerService('test-plugin', TestService, instance);

      expect(service.hasService('test-plugin', TestService)).toBe(true);
    });

    it('should return false when service does not exist', () => {
      expect(service.hasService('nonexistent-plugin', TestService)).toBe(false);
    });

    it('should return false after service is cleared', () => {
      const instance = new TestService();
      service.registerService('test-plugin', TestService, instance);

      service.clearPluginServices('test-plugin');

      expect(service.hasService('test-plugin', TestService)).toBe(false);
    });
  });

  describe('getPluginServices', () => {
    it('should return all services for a plugin', () => {
      const testInstance = new TestService();
      const anotherInstance = new AnotherService();

      service.registerService('test-plugin', TestService, testInstance);
      service.registerService('test-plugin', AnotherService, anotherInstance);

      const services = service.getPluginServices('test-plugin');

      expect(services).toHaveLength(2);
      expect(services).toContain(TestService);
      expect(services).toContain(AnotherService);
    });

    it('should return empty array when plugin has no services', () => {
      const services = service.getPluginServices('nonexistent-plugin');

      expect(services).toEqual([]);
    });

    it('should not include services from other plugins', () => {
      const instance = new TestService();

      service.registerService('plugin-a', TestService, instance);
      service.registerService('plugin-b', AnotherService, new AnotherService());

      const servicesA = service.getPluginServices('plugin-a');
      const servicesB = service.getPluginServices('plugin-b');

      expect(servicesA).toHaveLength(1);
      expect(servicesA).toContain(TestService);

      expect(servicesB).toHaveLength(1);
      expect(servicesB).toContain(AnotherService);
    });
  });

  describe('clearPluginServices', () => {
    it('should remove all services for a plugin', () => {
      const testInstance = new TestService();
      const anotherInstance = new AnotherService();

      service.registerService('test-plugin', TestService, testInstance);
      service.registerService('test-plugin', AnotherService, anotherInstance);

      service.clearPluginServices('test-plugin');

      expect(service.getPluginServices('test-plugin')).toEqual([]);
      expect(service.getService('test-plugin', TestService)).toBeNull();
      expect(service.getService('test-plugin', AnotherService)).toBeNull();
    });

    it('should not affect services from other plugins', () => {
      const instance = new TestService();

      service.registerService('plugin-a', TestService, instance);
      service.registerService('plugin-b', TestService, new TestService());

      service.clearPluginServices('plugin-a');

      expect(service.getService('plugin-a', TestService)).toBeNull();
      expect(service.getService('plugin-b', TestService)).not.toBeNull();
    });

    it('should handle clearing non-existent plugin gracefully', () => {
      expect(() => {
        service.clearPluginServices('nonexistent-plugin');
      }).not.toThrow();
    });
  });

  describe('clearAllServices', () => {
    it('should remove all services from all plugins', () => {
      service.registerService('plugin-a', TestService, new TestService());
      service.registerService('plugin-b', AnotherService, new AnotherService());

      service.clearAllServices();

      expect(service.getService('plugin-a', TestService)).toBeNull();
      expect(service.getService('plugin-b', AnotherService)).toBeNull();
      expect(service.getAllServices()).toEqual([]);
    });
  });

  describe('getAllServices', () => {
    it('should return information about all registered services', () => {
      service.registerService('plugin-a', TestService, new TestService(), 'singleton');
      service.registerService('plugin-b', AnotherService, new AnotherService(), 'transient');

      const allServices = service.getAllServices();

      expect(allServices).toHaveLength(2);
      expect(allServices).toContainEqual({
        pluginId: 'plugin-a',
        serviceName: 'TestService',
        scope: 'singleton',
      });
      expect(allServices).toContainEqual({
        pluginId: 'plugin-b',
        serviceName: 'AnotherService',
        scope: 'transient',
      });
    });

    it('should return empty array when no services are registered', () => {
      const allServices = service.getAllServices();

      expect(allServices).toEqual([]);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle service name collisions across plugins', () => {
      const instanceA = new TestService();
      const instanceB = new TestService();

      service.registerService('plugin-a', TestService, instanceA, 'singleton');
      service.registerService('plugin-b', TestService, instanceB, 'singleton');

      const retrievedA = service.getService('plugin-a', TestService);
      const retrievedB = service.getService('plugin-b', TestService);

      expect(retrievedA).toBe(instanceA);
      expect(retrievedB).toBe(instanceB);
      expect(retrievedA).not.toBe(retrievedB);
    });

    it('should support changing service scope', () => {
      const instance1 = new TestService();
      service.registerService('test-plugin', TestService, instance1, 'singleton');

      const retrieved1 = service.getService('test-plugin', TestService);
      const retrieved2 = service.getService('test-plugin', TestService);
      expect(retrieved1).toBe(retrieved2);

      // Re-register as transient
      service.registerService('test-plugin', TestService, instance1, 'transient');

      const retrieved3 = service.getService('test-plugin', TestService);
      const retrieved4 = service.getService('test-plugin', TestService);
      expect(retrieved3).not.toBe(retrieved4);
    });

    it('should handle services with complex constructor dependencies', () => {
      @Injectable()
      class ComplexService {
        constructor(private readonly dependency: TestService) {}

        getDependency() {
          return this.dependency;
        }
      }

      const dependency = new TestService();
      const complex = new ComplexService(dependency);

      service.registerService('test-plugin', ComplexService, complex, 'singleton');

      const retrieved = service.getService('test-plugin', ComplexService);

      expect(retrieved).toBe(complex);
      expect(retrieved?.getDependency()).toBe(dependency);
    });
  });

  describe('Performance', () => {
    it('should efficiently handle large number of services', () => {
      const startTime = Date.now();

      // Register 1000 services
      for (let i = 0; i < 1000; i++) {
        service.registerService(`plugin-${i}`, TestService, new TestService(), 'singleton');
      }

      const registrationTime = Date.now() - startTime;

      // Lookup should be fast
      const lookupStartTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        service.getService(`plugin-${i}`, TestService);
      }
      const lookupTime = Date.now() - lookupStartTime;

      // Both operations should be reasonably fast (< 100ms each on modern hardware)
      expect(registrationTime).toBeLessThan(100);
      expect(lookupTime).toBeLessThan(100);
    });
  });
});
