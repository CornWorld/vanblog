# Backend Directory Structure

> How server-ng code is organized.

---

## Overview

The backend follows NestJS module-based architecture with clear separation of concerns.

---

## Root Structure

```
packages/server-ng/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── modules/                   # Feature modules (21 modules)
│   ├── core/                      # Core functionality
│   ├── config/                    # Configuration management
│   ├── database/                  # Database connection
│   └── shared/                    # Shared utilities
├── test/                          # Test files (mirrors src/ structure)
├── plugins/                       # Plugin directory (8 built-in plugins)
├── docs/                          # Module documentation
├── drizzle.config.ts              # Drizzle configuration
├── vitest.config.ts               # Vitest configuration
└── eslint.config.mjs              # ESLint configuration
```

---

## Module Structure

Each module in `src/modules/` follows this pattern:

```
{module-name}/
├── controllers/           # API controllers (ts-rest routers)
│   └── {module}.controller.ts
├── services/              # Business logic
│   └── {module}.service.ts
├── dto/                   # Data transfer objects (if needed)
├── {module}.module.ts     # NestJS module definition
├── {module}.spec.ts       # Unit tests
└── utils/                 # Module-specific utilities (optional)
```

---

## Core Modules

### Plugin Module (`src/modules/plugin/`)

The largest and most complex module:

```
plugin/
├── controllers/
│   ├── plugin-http.controller.ts    # Plugin HTTP routes
│   └── plugins.controller.ts        # Plugin management API
├── services/
│   ├── plugin-api.service.ts        # Functional API implementation
│   ├── plugin-config.service.ts     # Configuration management
│   ├── plugin-http-registry.service.ts  # HTTP route registration
│   ├── plugin-service-registry.service.ts  # Service registration
│   └── signal.service.ts            # Reactive signals
└── utils/
    ├── drizzle-to-sql.util.ts       # Drizzle → SQL conversion
    ├── schema-to-table.util.ts      # Schema → Table conversion
    └── ts-rest-router.util.ts       # ts-rest router utilities
```

### Shortcode Module (`src/modules/shortcode/`)

Handles plugin-registered shortcodes for content transformation.

---

## Core Directory

```
src/core/
├── filters/              # Exception filters
├── interceptors/         # Interceptors (logging, transform)
├── guards/               # Guards (authentication, permissions)
└── pipes/                # Pipes (validation, transformation)
```

---

## Database Directory

```
src/database/
├── database.module.ts    # Database module
├── database.service.ts   # Database connection service
└── migrations/           # Migration files (generated)
```

---

## Test Structure

Tests mirror the `src/` structure:

```
test/
├── units/                # Unit tests (mirrors src/ structure)
├── e2e/                  # E2E tests
└── fixtures/             # Test fixtures
```

**Naming Convention**: Test files use `.spec.ts` suffix (not `.test.ts`).

---

## Plugins Directory

```
plugins/
├── beian-plugin/         # ICP filing information
├── book-manager-plugin/  # Book management
├── cat-plugin/           # Visitor tracking
├── email-notification-plugin/  # Email notifications
├── read-time-plugin/     # Reading time calculation
├── rewards-plugin/       # Tipping/rewards
├── social-links-plugin/  # Social media links
└── rss-plugin/           # RSS feed generation
```

Each plugin has:

```
{plugin-name}/
├── index.ts              # Plugin entry (functional API)
├── index.spec.ts         # Tests
├── package.json          # Plugin metadata (optional)
└── README.md             # Plugin documentation (optional)
```

---

## Docs Directory

```
docs/
├── PLUGIN_DEVELOPMENT.md      # Plugin development guide
├── PLUGIN_MIGRATION_COMPLEX.md # Complex plugin migration
└── SHORTCODE_GUIDE.md         # Shortcode system guide
```

---

## File Naming Conventions

| Type        | Pattern                | Example                   |
| ----------- | ---------------------- | ------------------------- |
| Controllers | `{name}.controller.ts` | `article.controller.ts`   |
| Services    | `{name}.service.ts`    | `article.service.ts`      |
| Modules     | `{name}.module.ts`     | `article.module.ts`       |
| Tests       | `{name}.spec.ts`       | `article.service.spec.ts` |
| Utilities   | `{name}.util.ts`       | `date.util.ts`            |

---

## Common Mistakes

1. **Plural in file names** - Use `article.service.ts`, not `articles.service.ts`
2. **Wrong test extension** - Use `.spec.ts`, not `.test.ts`
3. **Missing test coverage** - All services must have tests (80% coverage threshold)
4. **Core logic in controllers** - Business logic belongs in services
5. **Direct console usage** - Use NestJS Logger instead

---

## Reference Examples

- Plugin Module: `src/modules/plugin/`
- Shortcode Module: `src/modules/shortcode/`
- Built-in Plugins: `plugins/`
