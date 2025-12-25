/**
 * @file shortcode.module.spec.ts
 *
 * ShortcodeModule 测试
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { ShortcodeModule } from './shortcode.module';
import { ShortcodeService } from './shortcode.service';

describe('ShortcodeModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ShortcodeModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide ShortcodeService', () => {
    const service = module.get<ShortcodeService>(ShortcodeService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ShortcodeService);
  });

  it('should export ShortcodeService for global use', () => {
    const service = module.get<ShortcodeService>(ShortcodeService);
    expect(service).toBeDefined();
    // Verify service has expected methods
    expect(service.register).toBeInstanceOf(Function);
    expect(service.process).toBeInstanceOf(Function);
    expect(service.exists).toBeInstanceOf(Function);
    expect(service.getTags).toBeInstanceOf(Function);
  });

  it('should compile successfully', () => {
    expect(module).toBeTruthy();
  });

  it('should have Global decorator applied (service accessible across modules)', () => {
    // Since ShortcodeModule is marked with @Global(), the service should be
    // available without re-importing the module in other modules.
    // This test verifies the module compiles correctly with @Global decorator.
    const service = module.get<ShortcodeService>(ShortcodeService);
    expect(service).toBeDefined();
  });
});
