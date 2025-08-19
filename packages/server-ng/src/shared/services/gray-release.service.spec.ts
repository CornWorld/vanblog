import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { GrayReleaseService } from './gray-release.service';

describe('GrayReleaseService', () => {
  let service: GrayReleaseService;
  let module: TestingModule;

  const makeModule = async (env: Record<string, unknown>): Promise<TestingModule> => {
    return Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: false,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => env],
        }),
      ],
      providers: [GrayReleaseService, ConfigService],
    }).compile();
  };

  beforeEach(async () => {
    module = await makeModule({});
    service = module.get(GrayReleaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('disabled globally by default', async () => {
    module = await makeModule({ ROLLOUT_ENABLED: false });
    service = module.get(GrayReleaseService);
    expect(service.isEnabledFor('pathname', { pathname: 'a' })).toBe(false);
  });

  it('whitelist should bypass percentage', async () => {
    module = await makeModule({
      ROLLOUT_ENABLED: true,
      ROLLOUT_PATHNAME_ENABLED: true,
      ROLLOUT_PATHNAME_PERCENT: 0,
      ROLLOUT_PATHNAME_WHITELIST: 'hot-article, special',
    });
    service = module.get(GrayReleaseService);
    expect(service.isPathnameEnabled({ pathname: 'hot-article' })).toBe(true);
    expect(service.isPathnameEnabled({ pathname: 'special' })).toBe(true);
    expect(service.isPathnameEnabled({ pathname: 'other' })).toBe(false);
  });

  it('percentage should work with stable bucketing', async () => {
    module = await makeModule({
      ROLLOUT_ENABLED: true,
      ROLLOUT_PASSWORD_ENABLED: true,
      ROLLOUT_PASSWORD_PERCENT: 50,
    });
    service = module.get(GrayReleaseService);
    const ctx = { id: 'u1', articleId: 'art1' };
    const a = service.isPasswordEnabled(ctx);
    const b = service.isPasswordEnabled(ctx);
    expect(a).toBe(b); // stable
  });

  it('clamps percentage between 0 and 100', async () => {
    module = await makeModule({
      ROLLOUT_ENABLED: true,
      ROLLOUT_PATHNAME_ENABLED: true,
      ROLLOUT_PATHNAME_PERCENT: 1000,
    });
    service = module.get(GrayReleaseService);
    // with 100% it should always enable when subject exists
    expect(service.isPathnameEnabled({ pathname: 'x', id: 'u' })).toBe(true);
  });

  it('subject fallback order should not crash', async () => {
    module = await makeModule({
      ROLLOUT_ENABLED: true,
      ROLLOUT_PASSWORD_ENABLED: true,
      ROLLOUT_PASSWORD_PERCENT: 100,
    });
    service = module.get(GrayReleaseService);
    // no id/ip/ua, falls back to articleId/pathname as secondary attached to empty base
    expect(service.isPasswordEnabled({ articleId: 'a1' })).toBe(true);
  });
});
