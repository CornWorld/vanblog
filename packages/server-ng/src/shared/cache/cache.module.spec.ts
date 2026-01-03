import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigService } from '../../config/config.service';
import { createConfigServiceMock } from '@test/mock';

import { CacheModule } from './cache.module';
import { CacheService } from './cache.service';
import { DerivedViewCacheService } from './derived-view-cache.service';

describe('CacheModule', () => {
  let module: TestingModule;

  // Mock ConfigService using the proper mock helper
  const mockConfigService = createConfigServiceMock();

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide CacheService', () => {
    const cacheService = module.get<CacheService>(CacheService);
    expect(cacheService).toBeDefined();
    expect(cacheService).toBeInstanceOf(CacheService);
  });

  it('should provide DerivedViewCacheService', () => {
    const derivedViewCacheService = module.get<DerivedViewCacheService>(DerivedViewCacheService);
    expect(derivedViewCacheService).toBeDefined();
    expect(derivedViewCacheService).toBeInstanceOf(DerivedViewCacheService);
  });

  it('should export CacheService', () => {
    const cacheService = module.get<CacheService>(CacheService);
    expect(cacheService).toBeDefined();
  });

  it('should export DerivedViewCacheService', () => {
    const derivedViewCacheService = module.get<DerivedViewCacheService>(DerivedViewCacheService);
    expect(derivedViewCacheService).toBeDefined();
  });
});
