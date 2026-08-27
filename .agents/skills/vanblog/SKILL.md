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

## Schema Verification

When creating or editing a schema-shaped payload (`site`, `pack.json`, theme config, or SDK model data):

1. Treat `sdk/src/models/` as the authority. Do not invent field names or enum values.
2. Before sending a payload to PB, validate it through the authenticated agent validation endpoint when `PB_TOKEN` is available:
   ```bash
   curl -s "$PB_URL/api/vanblog/agent/validate" \
     -H "Authorization: $PB_TOKEN" \
     -H 'Content-Type: application/json' \
     --data @payload.json
   ```
3. If the response contains `"valid":false`, fix every item in `issues` and validate again. Do not ignore an issue or save the invalid payload.
4. PB record saves still perform the final runtime validation. The endpoint is a preflight check, not a replacement for the runtime guard.

Do not run this check for ordinary Markdown, CSS, or source-code edits unless the change contains a schema-shaped JSON object.

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
4. Load: Pack hooks are staged at PocketBase startup only — there is no runtime restage. After writing a new pack, trigger a supervised service restart so the pack takes effect:
   ```bash
   curl -X POST "$PB_URL/api/vanblog/system/restart" -H "Authorization: $PB_TOKEN"
   ```
5. Wait for recovery: poll `$PB_URL/api/health` until it returns 200 (~5-15s downtime).
6. Test: verify pack hooks respond (curl the endpoints) and frontend scripts inject correctly.

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
- Service restart: `POST /api/vanblog/system/restart` causes ~5-15s API downtime; poll `/api/health` afterward. Do not call restart concurrently.
