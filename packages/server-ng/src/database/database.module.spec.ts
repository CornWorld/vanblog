import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 注意：必须在导入被测模块之前进行 mock
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  run: vi.fn(),
};

type MockDb = typeof mockDb;

let currentMock: MockDb = mockDb;

// 使用顶层 mock，避免 Vitest 对 vi.mock 的提升导致的作用域问题
vi.mock('./connection', () => ({
  createDatabaseConnection: vi.fn(async () => await Promise.resolve(currentMock)),
}));

describe('DatabaseModule', () => {
  beforeEach(() => {
    vi.resetModules();
    currentMock = mockDb;
  });

  it('should provide DATABASE_CONNECTION via factory (mocked)', async () => {
    currentMock = mockDb;

    const { DatabaseModule, DATABASE_CONNECTION } = await import('./database.module');

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    const db = module.get<MockDb>(DATABASE_CONNECTION);

    expect(db).toBe(mockDb);
    expect(typeof db.select).toBe('function');
  });

  it('should be able to resolve multiple times with mocked connection', async () => {
    const anotherMock: MockDb = { ...mockDb };
    currentMock = anotherMock;

    const { DatabaseModule, DATABASE_CONNECTION } = await import('./database.module');

    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    const db = module.get<MockDb>(DATABASE_CONNECTION);
    expect(db).toBe(anotherMock);
  });
});
