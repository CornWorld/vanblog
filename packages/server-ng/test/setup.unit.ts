// Vitest setup file for unit tests (no database initialization)
import 'reflect-metadata';
import { vi } from 'vitest';

console.log('[setup.unit.ts] Loading unit test setup...');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-key';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-key';

// Prevent unintended outbound network calls in unit tests
(globalThis as any).fetch = vi.fn(async () => {
  await Promise.resolve();
  throw new Error('Unexpected network call in unit tests');
});

console.log('[setup.unit.ts] Loading database setup...');
// Export db instance for unit tests that need database access
// Re-export from setup.ts
export { db } from './setup';

console.log('[setup.unit.ts] Unit test setup complete');

