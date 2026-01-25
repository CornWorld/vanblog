import { describe, it, expect } from 'vitest';

import { TagModule } from './tag.module';

describe('TagModule', () => {
  it('should be defined', () => {
    expect(TagModule).toBeDefined();
  });

  it('should have imports, controllers, providers, and exports', () => {
    const metadata = Reflect.getMetadata('imports', TagModule) || [];
    const controllers = Reflect.getMetadata('controllers', TagModule) || [];
    const providers = Reflect.getMetadata('providers', TagModule) || [];
    const exports = Reflect.getMetadata('exports', TagModule) || [];

    expect(metadata.length).toBeGreaterThan(0); // has imports
    expect(controllers.length).toBeGreaterThan(0); // has controllers
    expect(providers.length).toBeGreaterThan(0); // has providers
    expect(exports.length).toBeGreaterThan(0); // has exports
  });
});
