# Test Data Factories - Quick Start Guide

## Installation (Already Done)

The test data factories are already set up and available for use! No installation required.

## Import Options

### Option 1: Direct Import (Recommended for Type Safety)

```typescript
import { createMockUser, createMockArticle, createMockTag } from '../test/fixtures/test-data';
```

### Option 2: Via MockUtils (Convenient)

```typescript
import { MockUtils } from '../test/mock-utils';
// Or destructure specific factories
import { createMockUser, createMockArticle } from '../test/mock-utils';
```

### Option 3: From Index (Clean)

```typescript
import { createMockUser, createMockArticle } from '../test/fixtures';
```

## Common Usage Patterns

### 1. Simple Test Data Creation

```typescript
import { createMockUser, createMockArticle } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should create an article', () => {
    // Create with defaults
    const user = createMockUser();
    const article = createMockArticle();

    expect(user.username).toBe('testuser');
    expect(article.title).toBe('Test Article');
  });
});
```

### 2. Customizing Specific Fields

```typescript
import { createMockArticle } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should handle hidden articles', () => {
    // Only customize what you need
    const hiddenArticle = createMockArticle({
      title: 'Secret Article',
      hidden: true,
      viewer: 0,
    });

    expect(hiddenArticle.hidden).toBe(true);
    // All other fields use defaults
    expect(hiddenArticle.author).toBe('admin');
  });
});
```

### 3. Creating Multiple Entities

```typescript
import { createMockArticles, createMockTags } from '../test/fixtures/test-data';

describe('TagService', () => {
  it('should find articles by tag', async () => {
    // Create 10 articles at once
    const articles = createMockArticles(10);
    const tags = createMockTags(3);

    databaseMock.setQueryResult(articles);

    const result = await service.findAll();
    expect(result).toHaveLength(10);
  });
});
```

### 4. Using with Database Mocks

```typescript
import { MockUtils } from '../test/mock-utils';
import { createMockArticle } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  let service: ArticleService;
  let databaseMock: DatabaseMockBuilder;

  beforeEach(async () => {
    databaseMock = new MockUtils.database();

    // Create test data
    const mockArticle = createMockArticle({ id: 1, title: 'Test' });

    // Setup mock to return test data
    databaseMock.setQueryResult([mockArticle]);

    const module = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: DATABASE_CONNECTION,
          useValue: databaseMock.build(),
        },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  it('should find article by id', async () => {
    const article = await service.findById(1);
    expect(article.title).toBe('Test');
  });
});
```

### 5. Testing with Related Entities

```typescript
import {
  createMockUser,
  createMockArticle,
  createMockTags,
  createMockCategory,
} from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should create article with tags and category', async () => {
    const author = createMockUser({ username: 'john' });
    const category = createMockCategory({ name: 'Technology' });
    const tags = createMockTags(3);

    const article = createMockArticle({
      author: author.username,
      category: category.name,
      tags: tags.map((t) => t.name),
      title: 'My Tech Article',
    });

    expect(article.author).toBe('john');
    expect(article.category).toBe('Technology');
    expect(article.tags).toHaveLength(3);
  });
});
```

### 6. Custom Dates

```typescript
import { createMockArticle } from '../test/fixtures/test-data';
import { dayjs } from '@vanblog/shared';

describe('ArticleService', () => {
  it('should filter by date range', async () => {
    const oldArticle = createMockArticle({
      createdAt: dayjs('2023-01-01').format(),
    });

    const recentArticle = createMockArticle({
      createdAt: dayjs().subtract(1, 'day').format(),
    });

    expect(dayjs(oldArticle.createdAt).isBefore(recentArticle.createdAt)).toBe(true);
  });
});
```

### 7. Testing Edge Cases

```typescript
import { createMockArticle, createMockUser } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should handle private articles with password', () => {
    const privateArticle = createMockArticle({
      private: true,
      password: 'secret123',
      hidden: false,
    });

    expect(privateArticle.private).toBe(true);
    expect(privateArticle.password).toBe('secret123');
  });

  it('should handle users without optional fields', () => {
    const basicUser = createMockUser({
      nickname: null,
      email: null,
      avatar: null,
    });

    expect(basicUser.nickname).toBeNull();
    expect(basicUser.email).toBeNull();
  });
});
```

### 8. Batch Operations with Custom Overrides

```typescript
import { createMockArticles } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should bulk import articles from same author', async () => {
    // All articles will have author: 'john' but unique IDs and titles
    const articles = createMockArticles(100, {
      author: 'john',
      hidden: false,
    });

    expect(articles).toHaveLength(100);
    articles.forEach((article) => {
      expect(article.author).toBe('john');
    });
  });
});
```

### 9. Type-Safe Testing

```typescript
import {
  createMockUser,
  createMockArticle,
  type MockUser,
  type MockArticle,
} from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should handle different article types', () => {
    // TypeScript ensures you only use valid fields
    const article: MockArticle = createMockArticle({
      title: 'Test',
      // TypeScript error if you try to add invalid field:
      // invalidField: 'oops' // ❌ Compile error
    });

    const user: MockUser = createMockUser();

    // Full autocomplete support
    expect(article.viewer).toBeDefined();
    expect(user.username).toBeDefined();
  });
});
```

## Migration from Old Pattern

### Before (Inline Object Literals)

```typescript
describe('ArticleService', () => {
  it('should create article', async () => {
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

    databaseMock.setInsertResult([mockArticle]);
    const result = await service.create(mockArticle);
    expect(result.title).toBe('Test Article');
  });
});
```

### After (Factory Functions)

```typescript
import { createMockArticle } from '../test/fixtures/test-data';

describe('ArticleService', () => {
  it('should create article', async () => {
    const mockArticle = createMockArticle({ title: 'Test Article' });

    databaseMock.setInsertResult([mockArticle]);
    const result = await service.create(mockArticle);
    expect(result.title).toBe('Test Article');
  });
});
```

**Benefits:**

- ✅ 12 lines → 2 lines (83% reduction)
- ✅ Only specify what's different from defaults
- ✅ Type-safe with autocomplete
- ✅ Consistent date formatting
- ✅ Easy to update when schema changes

## Available Factories Quick Reference

| Entity     | Factory Function             | Batch Helper              |
| ---------- | ---------------------------- | ------------------------- |
| User       | `createMockUser()`           | `createMockUsers(n)`      |
| Article    | `createMockArticle()`        | `createMockArticles(n)`   |
| Tag        | `createMockTag()`            | `createMockTags(n)`       |
| Category   | `createMockCategory()`       | `createMockCategories(n)` |
| Draft      | `createMockDraft()`          | -                         |
| Media      | `createMockMedia()`          | `createMockMediaFiles(n)` |
| Webhook    | `createMockWebhook()`        | -                         |
| Analytics  | `createMockAnalytics()`      | -                         |
| Setting    | `createMockSetting()`        | -                         |
| Comment    | `createMockComment()`        | -                         |
| _+10 more_ | See [README.md](./README.md) | -                         |

## Common Gotchas

### 1. Don't Forget to Import

```typescript
// ❌ Wrong - no import
const user = createMockUser(); // ReferenceError

// ✅ Correct
import { createMockUser } from '../test/fixtures/test-data';
const user = createMockUser();
```

### 2. Use Partial Override Syntax

```typescript
// ❌ Wrong - trying to spread entire object
const user = {
  ...createMockUser(),
  username: 'john',
};

// ✅ Correct - use overrides parameter
const user = createMockUser({ username: 'john' });
```

### 3. Date Formatting

```typescript
// ❌ Wrong - using Date objects
const article = createMockArticle({
  createdAt: new Date(), // Type error
});

// ✅ Correct - use dayjs format
import { dayjs } from '@vanblog/shared';
const article = createMockArticle({
  createdAt: dayjs().format(),
});
```

## Next Steps

1. **Read the full documentation**: [README.md](./README.md)
2. **Check out examples**: [test-data.spec.ts](./test-data.spec.ts)
3. **Start using in your tests**: Import and use!

## Support

For questions or issues:

1. Check the [README.md](./README.md) for detailed API reference
2. Look at [test-data.spec.ts](./test-data.spec.ts) for comprehensive examples
3. Refer to [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for design decisions

Happy testing! 🎉
