/**
 * Transaction Isolation Test
 *
 * This test verifies that Drizzle's native transaction API properly isolates
 * transaction data from the main database connection.
 */

import { describe, it, expect } from 'vitest';
import { db } from '../setup.unit';
import { tags, articles, articleTags, categories } from '@vanblog/shared/drizzle';
import { eq, inArray } from 'drizzle-orm';

describe('Transaction Isolation Test', () => {
  it('should isolate data using Drizzle native transaction', async () => {
    // Clean up any existing test data first
    await db.delete(articleTags).where(eq(articleTags.articleId, 999001));
    await db.delete(articles).where(eq(articles.id, 999001));
    await db.delete(categories).where(eq(categories.id, 999001));
    await db.delete(tags).where(eq(tags.id, 999001));

    // Test using Drizzle's native db.transaction() API
    // We need to throw an error to trigger rollback
    try {
      await db.transaction(async (tx) => {
        // Create test data inside transaction
        const [tag1] = await tx
          .insert(tags)
          .values({
            id: 999001,
            name: 'TxTestTag1',
            slug: 'tx-test-tag-1',
            createdAt: new Date().toISOString(),
          })
          .returning();

        const [category1] = await tx
          .insert(categories)
          .values({
            id: 999001,
            name: 'TxTestCategory1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .returning();

        const [article1] = await tx
          .insert(articles)
          .values({
            id: 999001,
            title: 'TxTestArticle1',
            content: 'Content',
            author: 'test',
            category: category1.name,
            hidden: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .returning();

        await tx.insert(articleTags).values({
          articleId: article1.id,
          tagName: tag1.name,
          createdAt: new Date().toISOString(),
        });

        // Query 1: Get article (should find it in transaction)
        const foundArticles = await tx.select().from(articles).where(eq(articles.id, article1.id));
        expect(foundArticles).toHaveLength(1);
        expect(foundArticles[0].title).toBe('TxTestArticle1');

        // Query 2: Get article tags (should find it in transaction)
        const foundArticleTags = await tx
          .select()
          .from(articleTags)
          .where(eq(articleTags.articleId, article1.id));
        expect(foundArticleTags).toHaveLength(1);
        expect(foundArticleTags[0].tagName).toBe('TxTestTag1');

        // Query 3: Complex query - get all articles and their tags
        const allArticles = await tx
          .select({ id: articles.id, category: articles.category })
          .from(articles)
          .where(eq(articles.id, article1.id));
        expect(allArticles).toHaveLength(1);

        const articleIds = allArticles.map((a) => a.id);
        const allArticleTags = await tx
          .select({ articleId: articleTags.articleId, tagName: articleTags.tagName })
          .from(articleTags)
          .where(inArray(articleTags.articleId, articleIds));

        expect(allArticleTags).toHaveLength(1);
        expect(allArticleTags[0].tagName).toBe('TxTestTag1');

        // Verify data aggregation in memory works
        const tagMap = new Map<number, string[]>();
        for (const tag of allArticleTags) {
          const existing = tagMap.get(tag.articleId) ?? [];
          existing.push(tag.tagName);
          tagMap.set(tag.articleId, existing);
        }

        const articleTags2 = tagMap.get(article1.id);
        expect(articleTags2).toBeDefined();

        expect(articleTags2!).toHaveLength(1);

        expect(articleTags2![0]).toBe('TxTestTag1');

        // Throw error to trigger rollback
        throw new Error('Test rollback');
      });
    } catch (error) {
      // Verify it's our expected error
      expect((error as Error).message).toBe('Test rollback');
    }

    // Verify data was rolled back - should not exist in main db
    const outsideTx = await db.select().from(articles).where(eq(articles.id, 999001));
    expect(outsideTx).toHaveLength(0);
  });

  it('should isolate data using manual BEGIN/ROLLBACK', async () => {
    // Clean up any existing test data first
    await db.delete(articleTags).where(eq(articleTags.articleId, 999002));
    await db.delete(articles).where(eq(articles.id, 999002));
    await db.delete(categories).where(eq(categories.id, 999002));
    await db.delete(tags).where(eq(tags.id, 999002));

    // Test using manual BEGIN/ROLLBACK (current approach)
    const { dbClient } = await import('../setup');
    const client = dbClient as any;

    await client.execute('BEGIN');

    try {
      // Create test data
      const [tag1] = await db
        .insert(tags)
        .values({
          id: 999002,
          name: 'ManualTestTag1',
          slug: 'manual-test-tag-1',
          createdAt: new Date().toISOString(),
        })
        .returning();

      const [category1] = await db
        .insert(categories)
        .values({
          id: 999002,
          name: 'ManualTestCategory1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();

      const [article1] = await db
        .insert(articles)
        .values({
          id: 999002,
          title: 'ManualTestArticle1',
          content: 'Content',
          author: 'test',
          category: category1.name,
          hidden: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning();

      await db.insert(articleTags).values({
        articleId: article1.id,
        tagName: tag1.name,
        createdAt: new Date().toISOString(),
      });

      // Query - this is where the problem might be
      const allArticles = await db
        .select({ id: articles.id, category: articles.category })
        .from(articles)
        .where(eq(articles.id, article1.id));
      expect(allArticles).toHaveLength(1);

      const articleIds = allArticles.map((a) => a.id);
      const allArticleTags = await db
        .select({ articleId: articleTags.articleId, tagName: articleTags.tagName })
        .from(articleTags)
        .where(inArray(articleTags.articleId, articleIds));

      expect(allArticleTags).toHaveLength(1);
      expect(allArticleTags[0].tagName).toBe('ManualTestTag1');

      await client.execute('ROLLBACK');
    } catch (error) {
      await client.execute('ROLLBACK');
      throw error;
    }

    // Verify rollback
    const outsideTx = await db.select().from(articles).where(eq(articles.id, 999002));
    expect(outsideTx).toHaveLength(0);
  });
});
