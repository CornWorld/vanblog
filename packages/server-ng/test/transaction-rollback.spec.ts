import { describe, it, expect } from 'vitest';
import { db } from './setup.unit';
import { withTestTransaction } from './utils/db-transaction-helper';
import { categories } from '@vanblog/shared/drizzle';

describe('Transaction Rollback Test', () => {
  it('test 1 - create category', async () => {
    await withTestTransaction(db, async (tx) => {
      await tx.insert(categories).values({
        name: 'Test1',
        slug: 'test1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await tx.select().from(categories);
      expect(result).toHaveLength(1);
    });
  });

  it('test 2 - should not see data from test 1', async () => {
    await withTestTransaction(db, async (tx) => {
      const result = await tx.select().from(categories);
      expect(result).toHaveLength(0); // Should be empty due to rollback
    });
  });
});
