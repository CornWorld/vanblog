import { describe, it, expect } from 'vitest';

import { UserModule } from './user.module';

describe('UserModule', () => {
  it('should be defined', () => {
    expect(UserModule).toBeDefined();
  });

  it('should have imports, controllers, providers, and exports', () => {
    const metadata = Reflect.getMetadata('imports', UserModule) || [];
    const controllers = Reflect.getMetadata('controllers', UserModule) || [];
    const providers = Reflect.getMetadata('providers', UserModule) || [];
    const exports = Reflect.getMetadata('exports', UserModule) || [];

    expect(metadata.length).toBeGreaterThan(0); // has imports
    expect(controllers.length).toBeGreaterThan(0); // has controllers
    expect(providers.length).toBeGreaterThan(0); // has providers
    expect(exports.length).toBeGreaterThan(0); // has exports
  });
});
