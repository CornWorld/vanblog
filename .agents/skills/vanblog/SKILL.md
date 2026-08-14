# VanBlog Dev Skill

Use this skill when the user asks about:

- Developing or customizing VanBlog themes
- Upgrading or downgrading VanBlog versions
- Migrating data from mereithhh/vanglog or other forks
- Developing VanBlog Packs (extensions)
- Editing content, site settings, or palette configurations

## Knowledge Layer

**This file is orchestration only.** For domain knowledge, always read `docs/` live:

- `docs/theme-concepts.md` — Theme system architecture, L0/L1/L2 contracts, overrides
- `docs/theme-implementer-guide.md` — How to build a theme, contract levels
- `docs/theme-host-design.md` — Theme host internals, loading mechanism
- `docs/reference/deployment.md` — Deploying VanBlog (facts)
- `docs/sdk-design.md` — VanBlog SDK architecture
- `docs/architecture-layering.md` — Overall project layering

For environment, source `. /etc/vanblog/agent.env` for `PB_URL`, `ASTRO_URL`, `VANBLOG_EMAIL`.

## Environment Setup

Source the agent env file before any operation:

```bash
. /etc/vanblog/agent.env
```

## Theme Development Workflow

1. **Read** `docs/theme-concepts.md` and `docs/theme-implementer-guide.md`
2. Understand the L0/L1/L2 contract levels
3. **Do not touch** restricted override paths: `themes/*/src/base-overrides/{pages/admin,pages/api,lib,loaders}/`
4. Build validation: `cd themes/<name> && pnpm build`
5. Type checking: `cd themes/<name> && pnpm check`

## Version Upgrade / Downgrade

1. **Read** `docs/theme-host-design.md` — understand theme loading mechanism
2. Check theme override compatibility:
   ```bash
   for theme in themes/*/; do
     name=$(basename "$theme")
     echo "=== $name overrides ==="
     find "$theme/src/base-overrides" -type f | sed "s|$theme/src/base-overrides/||"
   done
   ```
3. L0 contract violations fail at build time — do not attempt to work around
4. L1/L2 changes: review diffs between versions, adapt overrides

## Data Migration (mereithhh/VanBlog)

1. Check migration endpoint availability:
   ```bash
   curl -s $PB_URL/api/vanblog/setup/status
   ```
2. Import endpoint: `POST /api/vanblog/migrate/import` (body=JSON, 100MB limit, transactional)
3. Migration module: `vault/internal/migration/` — read before running

## Pack Development

1. Reference a working pack: `packs/bookmarks/` — the canonical example
2. Pack structure: `pack.json` + `hooks/` (JSVM) + `pages/` (Astro)
3. Build: `pnpm --filter sdk build` (after SDK changes)
4. Test: restart dev container, verify pack appears in nav

## Build Commands

```bash
pnpm --filter sdk build              # SDK (run after sdk/src changes)
pnpm --filter vanblog-app build      # Admin SSR app
cd themes/<name> && pnpm dev         # Theme HMR
cd themes/<name> && pnpm build       # Theme build validation
cd themes/<name> && pnpm check       # Astro type check
cd vault && go build -o bin/vanblog . # Go backend binary
```

## Constraints

- **Do not modify**: `app/src/pages/admin/**`, `app/src/pages/api/**`, `app/src/lib/**`, `app/src/loaders/**`, `app/src/middleware.*`, `app/src/live.config.*`, `vault/pb_migrations/*.go`, `sdk/src/` public API signatures
- CSS: always use `var(--color-*)` tokens, never hardcode colors
- Theme overrides: preserve all existing props, add optional new props only
- Destructive operations (data deletion, schema changes): dry-run first, confirm with user
