// Vitest setup file for unit tests (no database initialization)
import 'reflect-metadata';
import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-key';

// Prevent unintended outbound network calls in unit tests
(globalThis as any).fetch = vi.fn(async () => {
  await Promise.resolve();
  throw new Error('Unexpected network call in unit tests');
});
