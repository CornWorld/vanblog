# Suggested Commands for VanBlog Development

## Installation & Setup
```bash
pnpm i                    # Install dependencies
```

## Development
```bash
pnpm dev                  # Start server-ng + admin
pnpm dev:server           # Start server-ng only
pnpm dev:admin            # Start admin only
pnpm dev:website          # Start website only
```

## Testing (IMPORTANT STRATEGY)
```bash
# Test single module file (PREFERRED)
pnpm test src/modules/article/article.service.spec.ts --run

# Test entire module
pnpm test src/modules/article/ --run

# DO NOT USE THESE:
# ❌ pnpm test:cov         # Full coverage (too slow)
# ❌ pnpm test --coverage  # Full coverage (too slow)
```

## Building
```bash
pnpm build                # Build all
pnpm build:server         # Build server-ng
pnpm build:admin          # Build admin
pnpm build:website        # Build website
```

## Database (Drizzle)
```bash
pnpm --filter @vanblog/server-ng db:generate   # Generate migrations
pnpm --filter @vanblog/server-ng db:push       # Push to database
pnpm --filter @vanblog/server-ng db:studio     # Open Drizzle Studio
```

## Code Quality
```bash
pnpm lint                 # Check all
pnpm lint --fix           # Auto-fix
```

## Plugins
```bash
pnpm plugin:create my-plugin   # Create new plugin
# Plugin location: packages/server-ng/plugins/
```

## Key Files
- `packages/server-ng/vitest.config.ts` - Test configuration
- `packages/server-ng/eslint.config.mjs` - Linting rules
- `tsconfig.base.json` - TypeScript base config
- `.prettierrc.js` - Code formatting

## Coverage Testing Strategy
- Use targeted test runs: `pnpm test path/to/file.spec.ts --run`
- Test one module at a time
- NEVER run full coverage (`pnpm test:cov`)
- Target modules for 90% coverage: article, auth, category, draft, setting
