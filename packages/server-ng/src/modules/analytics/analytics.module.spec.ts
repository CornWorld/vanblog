import { describe, it, expect } from 'vitest';

import { AnalyticsModule } from './analytics.module';

describe('AnalyticsModule', () => {
  it('should be defined', () => {
    expect(AnalyticsModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', AnalyticsModule) || [];
    const controllers = Reflect.getMetadata('controllers', AnalyticsModule) || [];
    const providers = Reflect.getMetadata('providers', AnalyticsModule) || [];
    const exports = Reflect.getMetadata('exports', AnalyticsModule) || [];

    expect(imports.length).toBeGreaterThan(0);
    expect(controllers.length).toBeGreaterThan(0);
    expect(providers.length).toBeGreaterThan(0);
    expect(exports.length).toBeGreaterThan(0);
  });
});
