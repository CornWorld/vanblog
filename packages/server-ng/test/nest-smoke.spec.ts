import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeAll } from 'vitest';

describe('nest-smoke', () => {
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    expect(moduleRef).toBeDefined();
  });

  it('runs', () => {
    expect(true).toBe(true);
  });
});
