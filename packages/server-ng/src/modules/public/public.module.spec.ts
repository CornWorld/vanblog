import { describe, it, expect } from 'vitest';

import { PublicModule } from './public.module';

describe('PublicModule', () => {
  it('should be defined', () => {
    expect(PublicModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', PublicModule) || [];
    const controllers = Reflect.getMetadata('controllers', PublicModule) || [];
    const providers = Reflect.getMetadata('providers', PublicModule) || [];

    expect(imports.length).toBeGreaterThan(0);
    expect(controllers.length).toBeGreaterThan(0);
    expect(providers.length).toBeGreaterThan(0);
  });
});
