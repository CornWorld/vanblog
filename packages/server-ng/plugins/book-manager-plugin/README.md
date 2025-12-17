# Book Manager Plugin

**Version**: 1.0.0
**Status**: Example Plugin (v2.0 Plugin API)

---

## 📚 Overview

This is a **demonstration plugin** showcasing the VanBlog v2.0 Plugin API features. It implements a complete book management system using the enhanced plugin capabilities.

**Purpose**: Educational example for v2.0 API usage

---

## ✨ Features Demonstrated

### 1. ✅ Database Access

```typescript
// Create plugin-specific table from Zod Schema
const bookTable = api.table('books', BookSchema);

// Direct database queries using Drizzle
const books = await api.db.select().from(bookTable);

// Access core tables (read-only)
const articles = await api.db.select().from(api.coreTable('articles'));
```

### 2. ✅ Dependency Injection

```typescript
// Inject NestJS services
const configService = api.inject(ConfigService);
const dbUrl = configService.get('DATABASE_URL');
```

### 3. ✅ Plugin Communication

```typescript
// Expose API to other plugins
const BookAPI = {
  search: async (query: string) => { /* ... */ },
  getByAuthor: async (author: string) => { /* ... */ },
};
api.exposeAPI('book', BookAPI);

// Other plugins can use it:
// const bookAPI = api.useAPI('book-manager-plugin', 'book');
```

### 4. ✅ Hook System

```typescript
// Filter hook (modify data)
api.filter('article.beforeCreate', (article) => {
  // Auto-add "book-review" tag if article references books
  return { ...article, tags: [...article.tags, 'book-review'] };
});

// Action hook (side effects)
api.action('article.afterCreate', (article) => {
  api.log.info(`Article created: ${article.title}`);
});
```

### 5. ✅ Shortcode System

```typescript
// Register shortcode
api.shortcode('book', async (attrs) => {
  const isbn = attrs.isbn;
  const book = await findBookByISBN(isbn);
  return `<div class="book-card">...</div>`;
});

// Usage in articles:
// [book isbn="978-0-123456-78-9"]
```

### 6. ✅ Configuration Management

```typescript
// Read configuration
const maxBooksPerAuthor = api.config.maxBooksPerAuthor as number;

// Listen to config changes
api.onConfigChange('maxBooksPerAuthor', (newValue) => {
  api.log.info(`Max books changed to: ${newValue}`);
});
```

### 7. ✅ Responsive Storage

```typescript
// Create reactive storage
const stats = api.store('stats', {
  totalBooks: 0,
  totalAuthors: 0,
});

// Auto-persisted on change
stats.value.totalBooks += 1;
```

### 8. ✅ Public Data System

```typescript
// Expose data to frontend via Bootstrap API
api.provide('bookStats', async () => {
  return {
    totalBooks: books.length,
    recentBooks: books.slice(0, 5),
  };
});
```

### 9. ✅ Lifecycle Hooks

```typescript
api.onActivate(async () => {
  // Initialize plugin
  await loadInitialData();
});

api.onDeactivate(() => {
  // Cleanup resources
  cleanup();
});
```

---

## 📊 Data Model

### Book Schema

```typescript
const BookSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  isbn: z.string().optional(),
  publishedYear: z.number().int().min(1000).max(9999).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
});
```

### Database Table

Automatically created as: `plugin_book-manager-plugin_books`

Columns:
- `id` - INTEGER (PRIMARY KEY)
- `title` - TEXT (NOT NULL)
- `author` - TEXT (NOT NULL)
- `isbn` - TEXT
- `published_year` - INTEGER
- `description` - TEXT
- `tags` - TEXT (JSON mode)
- `rating` - REAL
- `created_at` - TEXT (ISO timestamp)
- `updated_at` - TEXT (ISO timestamp)

---

## 🔌 Plugin API Usage

### Exposed APIs

Other plugins can use the Book API:

```typescript
// In another plugin
export default (api: PluginAPI) => {
  const bookAPI = api.useAPI<BookAPIType>('book-manager-plugin', 'book');

  if (bookAPI) {
    // Search books
    const results = await bookAPI.search('typescript');

    // Get books by author
    const authorBooks = await bookAPI.getByAuthor('John Doe');

    // Add a book
    const newBook = await bookAPI.addBook({
      title: 'My Book',
      author: 'John Doe',
      rating: 5,
    });

    // Get recommendations
    const recommended = await bookAPI.getRecommendations(5);
  }
};
```

---

## 🎨 Shortcode Usage

### In Articles

```markdown
# My Book Review

Here's a great book I read:

[book isbn="978-0-123456-78-9"]

The book discusses...
```

### Rendered Output

```html
<div class="book-card">
  <h3 class="book-title">The Great Book</h3>
  <p class="book-author">by John Doe</p>
  <p class="book-year">2023</p>
  <p class="book-rating">⭐ 5/5</p>
  <p class="book-description">A wonderful exploration of...</p>
  <p class="book-tags">Tags: programming, typescript</p>
</div>
```

---

## 📡 Frontend Integration

### Bootstrap API Response

`GET /api/v2/public/bootstrap`

```json
{
  "extensions": {
    "bookStats": {
      "version": "1.0.0",
      "data": {
        "totalBooks": 42,
        "totalAuthors": 15,
        "recentBooks": [
          {
            "title": "TypeScript Handbook",
            "author": "John Doe",
            "rating": 5
          }
        ]
      }
    }
  }
}
```

### React Component Example

```tsx
import { usePluginData } from '@/hooks/usePluginData';

function BookStatsWidget() {
  const { data, loading } = usePluginData('bookStats');

  if (loading || !data) return null;

  return (
    <div className="book-stats">
      <h3>Book Statistics</h3>
      <p>Total Books: {data.totalBooks}</p>
      <p>Total Authors: {data.totalAuthors}</p>
      <h4>Recent Books:</h4>
      <ul>
        {data.recentBooks.map((book, i) => (
          <li key={i}>
            {book.title} by {book.author} (⭐ {book.rating})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# Plugin configuration (optional, overrides defaults)
PLUGIN_BOOK_MANAGER_PLUGIN_ENABLED=true
PLUGIN_BOOK_MANAGER_PLUGIN_MAX_BOOKS_PER_AUTHOR=10
```

### Admin Panel

Configure via VanBlog Admin Panel:
1. Navigate to **Settings** → **Plugins**
2. Find **Book Manager (v2.0 Example)**
3. Edit configuration:
   - **Enable Plugin**: ON/OFF
   - **Max Books Per Author**: Number (default: 10)

---

## 🚀 Installation

### Automatic (Built-in)

This plugin is included in VanBlog by default as an example.

### Manual Installation

1. Copy plugin folder to `packages/server-ng/plugins/book-manager-plugin/`
2. Restart the server:
   ```bash
   pnpm dev:server
   ```
3. Plugin will be auto-loaded on startup

---

## 🧪 Testing the Plugin

### 1. Check Plugin Logs

```bash
pnpm dev:server

# Look for:
# [book-manager-plugin] Book Manager Plugin v2.0 initializing...
# [book-manager-plugin] Book table created/loaded successfully
# [book-manager-plugin] Book API exposed to other plugins
# [book-manager-plugin] Book Manager Plugin v2.0 initialized successfully! 🎉
```

### 2. Test Database Access

```typescript
// In another plugin or controller
const books = await db.select().from(api.coreTable('plugin_book-manager-plugin_books'));
console.log(`Found ${books.length} books`);
```

### 3. Test Plugin Communication

```typescript
// In another plugin
const bookAPI = api.useAPI('book-manager-plugin', 'book');
const searchResults = await bookAPI.search('typescript');
console.log(searchResults);
```

### 4. Test Shortcode

Create an article with:
```markdown
[book isbn="test-isbn"]
```

The shortcode will render a book card (or error if book not found).

---

## 📝 Code Structure

```
book-manager-plugin/
├── package.json          # Plugin metadata & config schema
├── index.ts              # Main plugin file (420 lines)
└── README.md             # This file
```

### Key Components

1. **Data Model** (lines 17-36): Zod Schema definition
2. **Table Creation** (lines 53-62): Dynamic table from schema
3. **Dependency Injection** (lines 73-81): Inject ConfigService
4. **Plugin API** (lines 88-150): Exposed book management functions
5. **Hooks** (lines 158-195): Article processing filters/actions
6. **Shortcode** (lines 202-233): Book card renderer
7. **Public Data** (lines 240-263): Frontend data provider
8. **Lifecycle** (lines 281-300): Activation/deactivation handlers

---

## 🎓 Learning Points

### What This Plugin Teaches

1. **Database Schema Design**: How to define tables using Zod
2. **Dynamic Table Creation**: How `api.table()` works
3. **Drizzle Query API**: How to use Drizzle ORM with plugin tables
4. **Plugin Communication**: How to share APIs between plugins
5. **Hook Integration**: How to modify core data flow
6. **Shortcode Development**: How to extend content rendering
7. **Frontend Integration**: How to expose data to React components

### Best Practices Demonstrated

- ✅ Type-safe schema definitions with Zod
- ✅ Proper error handling and logging
- ✅ Configuration validation
- ✅ Resource cleanup in `onDeactivate`
- ✅ Responsive state management with `api.store()`
- ✅ Clear API documentation via JSDoc
- ✅ Modular code organization

---

## 🐛 Known Limitations

1. **Table Migration**: Database tables must be manually created via `pnpm db:push` currently
2. **HTTP Routes**: Not yet implemented (v2.0 Phase 3)
3. **Resource Registration**: `api.registerResource()` not yet available
4. **Metadata System**: `api.meta.*` not yet available

---

## 🔮 Future Enhancements

Once v2.0 is complete, this plugin could be enhanced with:

1. **HTTP API** (Phase 3):
   ```typescript
   api.http.contract({
     getBooks: {
       method: 'GET',
       path: '/books',
       responses: { 200: z.array(BookSchema) },
     },
   }, {
     getBooks: async () => {
       const books = await api.db.select().from(bookTable);
       return { status: 200, body: books };
     },
   });
   ```

2. **Declarative Resource** (Phase 4):
   ```typescript
   api.registerResource('book', {
     schema: BookSchema,
     endpoints: { list: true, create: true, update: true, delete: true },
   });
   ```

3. **Metadata System** (Phase 5):
   ```typescript
   // Store book-specific metadata on articles
   await api.meta.set('article', articleId, 'relatedBook', bookId);
   ```

---

## 📚 Related Documentation

- [Plugin Development Guide](../../docs/PLUGIN_DEVELOPMENT.md)
- [v2.0 API Reference](../../../shared/src/plugin/api.ts)
- [Implementation Status](./.tmp/plugin-api-v2-implementation-status.md)
- [v2.0 Design Specification](../../../.claude/plan/增强插件系统设计方案.md)

---

## 🙋 Support

This is an **example plugin** for demonstration purposes.

For questions about the v2.0 Plugin API:
- Check the [Plugin Development Guide](../../docs/PLUGIN_DEVELOPMENT.md)
- Review the [API Interface](../../../shared/src/plugin/api.ts)
- See other example plugins in `packages/server-ng/plugins/`

---

**Created**: 2025-12-14
**Author**: VanBlog Team
**License**: MIT
