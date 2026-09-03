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
2. Before sending a payload to PB, validate it through the authenticated agent validation endpoint (dev container only — prod does not register agent routes) when `PB_TOKEN` is available:
   ```bash
   curl -s "$PB_URL/api/vanblog/agent/validate" \
     -H "Authorization: $PB_TOKEN" \
     -H 'Content-Type: application/json' \
     --data @payload.json
   ```
3. If the response contains `"valid":false`, fix every item in `issues` and validate again. Do not ignore an issue or save the invalid payload.
4. PB record saves still perform the final runtime validation. The endpoint is a preflight check, not a replacement for the runtime guard.

Do not run this check for ordinary Markdown, CSS, or source-code edits unless the change contains a schema-shaped JSON object.

## Cross-Session Memory

Sessions start from zero — pi has no cross-session knowledge. Vanblog keeps
agent memory as **plain Markdown files** under `<pb_data>/agent-memory/`
(`$VANBLOG_DATA_DIR` from agent.env, default `/pb_data`), persisted with the
data volume. **Read before acting, append after finishing.**

### Read (session start)

Before starting any task, read the memory files relevant to the task domain:

```bash
. /etc/vanblog/agent.env
MEM_DIR="${VANBLOG_DATA_DIR:-/pb_data}/agent-memory"
ls "$MEM_DIR" 2>/dev/null && cat "$MEM_DIR"/*.md 2>/dev/null
```

Apply active entries as prior context — they are decisions/lessons from
earlier sessions, not speculative advice. Ignore `status: superseded` entries.

### Append (after task completion)

Record decisions, lessons, and preferences that will matter in future
sessions. One entry per file per domain, newest first:

```markdown
## 2026-09-03 — 主题 override 检查
- status: active
- domain: theme
- 升级后必须逐个 diff themes/*/src/base-overrides/<rel> vs app/src/<rel>,
  按 L0/L1/L2 判断影响;L0 永远稳定、L1 可加不可减、L2 无保证
```

Rules:

- **Write only durable knowledge**: decisions, lessons, user preferences,
  gotchas. Never transient facts (a port that changed this run, a temp fix).
- **Domain files**: `theme.md`, `migration.md`, `pack.md`, `upgrade.md`,
  `general.md` — one file per task domain, so future sessions read only what
  they need. Create a file when a domain first appears.
- **Status lifecycle**: new entries are `active`. When a later entry
  supersedes an earlier one, mark the earlier `status: superseded` — do not
  delete it (history matters, and superseded entries are ignored on read).
- **Prefer docs over memory**: if a fact belongs in `docs/` (authoritative,
  versioned), write it there instead — memory is for experience, docs are for
  reference. Cross-reference the docs path in the entry when relevant.
- **Never store secrets** in memory files (API keys, passwords, tokens).

## Theme Development Workflow

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
