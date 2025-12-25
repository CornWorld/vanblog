import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { HealthModule } from './health.module';
import { HealthController } from './health.controller';

describe('HealthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide HealthController', () => {
    const controller = module.get<HealthController>(HealthController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(HealthController);
  });

  it('should compile successfully', () => {
    expect(module).toBeTruthy();
  });
});
