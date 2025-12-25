import { describe, it, expect } from 'vitest';

import { MetricsModule } from './metrics.module';

describe('MetricsModule', () => {
  it('should be defined', () => {
    expect(MetricsModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', MetricsModule) || [];
    const controllers = Reflect.getMetadata('controllers', MetricsModule) || [];

    expect(imports.length).toBeGreaterThan(0);
    expect(controllers.length).toBeGreaterThan(0);
  });
});
