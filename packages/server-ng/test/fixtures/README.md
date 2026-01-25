# Test Data Fixtures

This directory contains factory functions for creating test data entities. These factories help eliminate duplicate test data definitions across test files.

## Overview

The `test-data.ts` file provides **20+ factory functions** for creating mock database entities with sensible defaults. Each factory:

- Provides complete, valid entity objects matching the database schema
- Accepts optional `overrides` parameter to customize specific fields
- Returns properly typed objects with TypeScript support
- Uses dayjs for consistent date formatting

## Usage

### Basic Usage

```typescript
import { createMockUser, createMockArticle } from '../test/fixtures/test-data';

// Create with defaults
const user = createMockUser();
// Returns: { id: 1, username: 'testuser', email: 'test@example.com', ... }

// Create with overrides
const admin = createMockUser({
  username: 'admin',
  type: 'admin',
});

const article = createMockArticle({
  title: 'Custom Title',
  viewer: 100,
});
```

### Via MockUtils (Recommended)

```typescript
import { MockUtils } from '../test/mock-utils';

// MockUtils re-exports all factories
const user = MockUtils.createMockUser();
const article = MockUtils.createMockArticle({ title: 'Test' });
```

### Batch Creation

Several batch creation helpers are available:

```typescript
import {
  createMockArticles,
  createMockTags,
  createMockCategories,
  createMockUsers,
  createMockMediaFiles,
} from '../test/fixtures/test-data';

// Create 5 articles with incremental IDs
const articles = createMockArticles(5);
// Returns: [
//   { id: 1, title: 'Test Article 1', ... },
//   { id: 2, title: 'Test Article 2', ... },
//   ...
// ]

// Create 10 tags with custom overrides
const tags = createMockTags(10, { createdAt: dayjs('2024-06-01').format() });
```

## Available Factories

### Core Entities

| Factory                  | Type               | Description                  |
| ------------------------ | ------------------ | ---------------------------- |
| `createMockUser`         | `MockUser`         | User entity with auth fields |
| `createMockArticle`      | `MockArticle`      | Article entity with content  |
| `createMockTag`          | `MockTag`          | Tag entity                   |
| `createMockCategory`     | `MockCategory`     | Category entity              |
| `createMockDraft`        | `MockDraft`        | Draft article entity         |
| `createMockDraftVersion` | `MockDraftVersion` | Draft version history        |

### Media & Files

| Factory                | Type          | Description               |
| ---------------------- | ------------- | ------------------------- |
| `createMockMedia`      | `MockMedia`   | Media file (images, etc.) |
| `createMockMediaFiles` | `MockMedia[]` | Batch create media files  |

### System & Settings

| Factory                | Type             | Description          |
| ---------------------- | ---------------- | -------------------- |
| `createMockSetting`    | `MockSetting`    | Site meta/settings   |
| `createMockAnalytics`  | `MockAnalytics`  | Analytics event data |
| `createMockLoginLog`   | `MockLoginLog`   | Login attempt log    |
| `createMockCustomPage` | `MockCustomPage` | Custom page content  |

### Webhooks & Integrations

| Factory                | Type             | Description           |
| ---------------------- | ---------------- | --------------------- |
| `createMockWebhook`    | `MockWebhook`    | Webhook configuration |
| `createMockWebhookLog` | `MockWebhookLog` | Webhook execution log |

### Permissions

| Factory                     | Type                  | Description           |
| --------------------------- | --------------------- | --------------------- |
| `createMockPermissionNode`  | `MockPermissionNode`  | Permission definition |
| `createMockPermissionGroup` | `MockPermissionGroup` | Permission group      |

### Plugins

| Factory                    | Type                 | Description               |
| -------------------------- | -------------------- | ------------------------- |
| `createMockPluginData`     | `MockPluginData`     | Plugin configuration data |
| `createMockPluginMetadata` | `MockPluginMetadata` | Plugin entity metadata    |

### Other Entities

| Factory                          | Type                       | Description             |
| -------------------------------- | -------------------------- | ----------------------- |
| `createMockComment`              | `MockComment`              | Comment entity (Waline) |
| `createMockImageProcessingQueue` | `MockImageProcessingQueue` | Image processing job    |
| `createMockTokenBlacklist`       | `MockTokenBlacklist`       | Blacklisted JWT token   |
| `createMockPipeline`             | `MockPipeline`             | Pipeline configuration  |

### Batch Helpers

| Helper                                    | Returns          | Description          |
| ----------------------------------------- | ---------------- | -------------------- |
| `createMockArticles(count, overrides?)`   | `MockArticle[]`  | Create N articles    |
| `createMockTags(count, overrides?)`       | `MockTag[]`      | Create N tags        |
| `createMockCategories(count, overrides?)` | `MockCategory[]` | Create N categories  |
| `createMockUsers(count, overrides?)`      | `MockUser[]`     | Create N users       |
| `createMockMediaFiles(count, overrides?)` | `MockMedia[]`    | Create N media files |

## Examples

### Testing Service Methods

```typescript
import { createMockUser, createMockArticle } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should create article', async () => {
    const user = createMockUser({ username: 'author' });
    const articleData = createMockArticle({
      author: user.username,
      title: 'New Article',
    });

    // Setup mock DB to return this data
    databaseMock.setInsertResult([articleData]);

    const result = await service.create(articleData);
    expect(result.title).toBe('New Article');
  });
});
```

### Testing with Multiple Entities

```typescript
import { createMockArticles, createMockTags } from '../test/fixtures/test-data';

describe('TagService', () => {
  it('should find articles by tag', async () => {
    const tags = createMockTags(3);
    const articles = createMockArticles(10, {
      tags: [tags[0].name],
    });

    databaseMock.setQueryResult(articles);

    const result = await service.getArticlesByTag(tags[0].id);
    expect(result).toHaveLength(10);
  });
});
```

### Custom Dates

```typescript
import { createMockArticle } from '../test/fixtures/test-data';
import { dayjs } from '@vanblog/shared';

const oldArticle = createMockArticle({
  createdAt: dayjs('2020-01-01').format(),
  updatedAt: dayjs('2020-01-01').format(),
});

const recentArticle = createMockArticle({
  createdAt: dayjs().subtract(1, 'day').format(),
  updatedAt: dayjs().format(),
});
```

## Design Principles

1. **Sensible Defaults**: All required fields have realistic default values
2. **Type Safety**: Full TypeScript support with exported interfaces
3. **Consistency**: Dates use dayjs with consistent formatting
4. **Flexibility**: Override any field via the `overrides` parameter
5. **Schema Alignment**: Factories match exact Drizzle table schemas

## Benefits

- **Reduces Code Duplication**: Eliminates ~500 lines of repeated test data definitions
- **Maintains Consistency**: Single source of truth for test data structure
- **Easier Refactoring**: Schema changes only need updates in one place
- **Better Readability**: Tests focus on logic, not data setup
- **Type Safe**: Compile-time checking of test data structure

## Migration Guide

### Before

```typescript
// Old pattern - inline object literals
const mockArticle = {
  id: 1,
  title: 'Test Article',
  content: 'Test content',
  tags: ['test'],
  author: 'admin',
  top: 0,
  hidden: false,
  private: false,
  viewer: 0,
  pathname: null,
  category: null,
  password: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};
```

### After

```typescript
// New pattern - factory function
import { createMockArticle } from '../test/fixtures/test-data';

const mockArticle = createMockArticle({
  title: 'Test Article',
});
// Only specify what's different from defaults!
```

## TypeScript Support

All factories export corresponding TypeScript interfaces:

```typescript
import type { MockUser, MockArticle, MockTag } from '../test/fixtures/test-data';

const user: MockUser = createMockUser();
const article: MockArticle = createMockArticle();
```

## Contributing

When adding a new database entity:

1. Add the interface (e.g., `MockEntity`)
2. Create the factory function (e.g., `createMockEntity`)
3. Add JSDoc comments
4. Export both the interface and function
5. Update this README

## See Also

- [MockUtils Documentation](../mock-utils.ts) - Database mocking utilities
- [Test Organization Guide](../../docs/TEST_ORGANIZATION_GUIDE.md) - Testing best practices
- [Database Schema](../../packages/shared/src/runtime/db.ts) - Source of truth for entity structures
