# Migrate Astro `/api/*` Endpoints to PB Go Routes

## Context

Caddy routes `/api/*` → PocketBase (127.0.0.1:8090), `/_/*` → PB, and `/*` → Astro dispatcher. This means all Astro `/api/*` endpoints are intercepted by PB and return 404 in production.

There are 7 Astro API endpoints in `app/src/pages/api/`. Three (feed/atom/sitemap) already have complete PB Go implementations. The remaining four need migration or retention.

## Analysis

### Decision Matrix

| # | Endpoint | PB Go? | Strategy |
|---|----------|--------|----------|
| 1 | `/api/feed.xml` | ✅ Yes (`routes.go`) | Delete Astro version |
| 2 | `/api/atom.xml` | ✅ Yes (`routes.go`) | Delete Astro version |
| 3 | `/api/sitemap.xml` | ✅ Yes (`routes.go`) | Delete Astro version |
| 4 | `/api/palette.css` | ❌ No | Implement in PB Go, delete Astro |
| 5 | `/api/palettes` (GET) | ❌ No | Implement in PB Go, delete Astro |
| 6 | `/api/themes` (GET) | ❌ No | Implement in PB Go, delete Astro |
| 7 | `/api/revalidate` (POST) | N/A (needs Astro SSR) | Keep in Astro |

### Key Observation

The `/api/revalidate` endpoint uses `context.cache.invalidate()` which is an Astro SSR runtime API. PB Go's `astro_revalidate.go` already calls the dispatcher directly at `ASTRO_URL` (default `http://127.0.0.1:4321`), bypassing Caddy. No change needed.

### Affected Files

**New Go files to create:**
- `vault/internal/palette/palette.go` — palette CSS generation + directory listing
- `vault/internal/palette/routes.go` — PB route registration for `/api/palette.css` and `/api/palettes`
- `vault/internal/theme/theme.go` — theme directory listing + metadata parsing
- `vault/internal/theme/routes.go` — PB route registration for `/api/themes`

**Files to modify:**
- `vault/main.go` — register new `palette.New(app)` and `theme.New(app)`
- `app/astro.config.mjs` — remove dead cache rules for `/api/feed.xml`, `/api/atom.xml`, `/api/sitemap.xml`
- `themes/default/astro.config.mjs` — same cache rule removal
- `themes/minimal/astro.config.mjs` — same
- `themes/bare/astro.config.mjs` — same

**Files to delete (Astro API endpoints — 6 files):**
- `app/src/pages/api/feed.xml.ts`
- `app/src/pages/api/atom.xml.ts`
- `app/src/pages/api/sitemap.xml.ts`
- `app/src/pages/api/palette.css.ts`
- `app/src/pages/api/palettes.ts`
- `app/src/pages/api/themes.ts`

**Files to delete (theme thin-shell re-exports — 9 files):**
- `themes/default/src/pages/api/feed.xml.ts`
- `themes/default/src/pages/api/atom.xml.ts`
- `themes/default/src/pages/api/sitemap.xml.ts`
- `themes/minimal/src/pages/api/feed.xml.ts`
- `themes/minimal/src/pages/api/atom.xml.ts`
- `themes/minimal/src/pages/api/sitemap.xml.ts`
- `themes/bare/src/pages/api/feed.xml.ts`
- `themes/bare/src/pages/api/atom.xml.ts`
- `themes/bare/src/pages/api/sitemap.xml.ts`

**Files that keep `/api/` references (unchanged — paths remain the same):**
- `app/src/layouts/BaseLayout.astro` — references `/api/palette.css`, `/api/feed.xml`, `/api/atom.xml`
- `app/src/components/Footer.astro` — references `/api/feed.xml`, `/api/atom.xml`, `/api/sitemap.xml`
- `themes/bare/src/builtin-overrides/layouts/BaseLayout.astro` — references same
- `app/src/pages/admin/site.astro` — fetches `/api/themes` and `/api/palettes`
- `app/src/pages/api/revalidate.ts` — stays in Astro
- `themes/*/src/pages/api/revalidate.ts` — stays in Astro
- `sdk/src/services.ts` — SDK calls unmodified
- `Dockerfile` line 138 — comment update only (the palette dir copy is still needed)

### Complexity

**Medium** — mostly file creation and deletion, low risk of regression. The palette/themes endpoints read from disk (simple file I/O). The feed/atom/sitemap endpoints are already proven in Go.

### Risk Areas

- `PALETTES_ROOT` / `THEMES_ROOT` path resolution in Go must match the Astro versions exactly
- Deleting thin-shell files before confirming all consumers are updated
- `revalidate.ts` must NOT be deleted

## Phases

### Phase 1: Implement PB Go Palette Endpoints (palette.css + palettes)

- **Goal**: Create Go handlers for `/api/palette.css` (GET) and `/api/palettes` (GET)
- **Files**:
  - NEW `vault/internal/palette/palette.go` — `GeneratePaletteCSS(app)` and `ListPalettes()`
  - NEW `vault/internal/palette/routes.go` — `New(app)` registers routes on PB
  - MODIFY `vault/main.go` — add `_ = palette.New(app)`
- **Steps**:
  - [ ] Create `vault/internal/palette/palette.go` with:
    - `PALETTES_ROOT` resolution: env var `VANBLOG_PALETTES_DIR` → `hooks/palettes` relative to CWD → `/build/hooks/palettes`
    - `readPaletteFiles(name)` — same logic as Astro: read `tokens.css` → `typography.css` → `components.css`, path traversal guard
    - `GeneratePaletteCSS(app)` — reads `site.palette` record, calls `readPaletteFiles`, returns CSS string
    - `ListPalettes()` — lists dirs in `hooks/palettes/`, reads `palette.json` metadata, returns sorted JSON
  - [ ] Create `vault/internal/palette/routes.go` with:
    - `New(app)` registers on `OnServe`:
      - `GET /api/palette.css` → serve palette CSS
      - `GET /api/palettes` → list palettes as JSON
  - [ ] Register in `vault/main.go`: `_ = palette.New(app)`
- **Done when**: Go build succeeds, no diagnostic errors

### Phase 2: Implement PB Go Theme Endpoint (/api/themes)

- **Goal**: Create Go handler for `/api/themes` (GET)
- **Files**:
  - NEW `vault/internal/theme/theme.go` — `ListThemes()` reads theme dirs + metadata
  - NEW `vault/internal/theme/routes.go` — `New(app)` registers route on PB
  - MODIFY `vault/main.go` — add `_ = theme.New(app)`
- **Steps**:
  - [ ] Create `vault/internal/theme/theme.go` with:
    - `THEMES_ROOT` resolution: env var `VANBLOG_THEMES_DIR` → `themes` relative to CWD → `/var/lib/vanblog/themes`
    - `ThemeMeta` struct matching `{name, label?, version?, author?, description?, screenshot?, recommendedPalette?, paletteMigrationMode?}`
    - `ListThemes()` — lists dirs in `themes/`, reads `theme.json` metadata, returns sorted JSON
  - [ ] Create `vault/internal/theme/routes.go` with:
    - `New(app)` registers on `OnServe`:
      - `GET /api/themes` → list themes as JSON
  - [ ] Register in `vault/main.go`: `_ = theme.New(app)`
- **Done when**: Go build succeeds, no diagnostic errors

### Phase 3: Delete Migrated Astro Endpoints + Thin-Shells

- **Goal**: Remove all Astro API endpoints that now live in PB Go
- **Files**: Delete 6 Astro endpoints + 9 theme thin-shell files (listed above)
- **Steps**:
  - [ ] Delete `app/src/pages/api/feed.xml.ts`, `atom.xml.ts`, `sitemap.xml.ts`
  - [ ] Delete `app/src/pages/api/palette.css.ts`, `palettes.ts`, `themes.ts`
  - [ ] Delete theme thin-shells: `themes/*/src/pages/api/feed.xml.ts`, `atom.xml.ts`, `sitemap.xml.ts` (3 themes × 3 files)
  - [ ] Verify `app/src/pages/api/revalidate.ts` is NOT deleted
  - [ ] Verify `themes/*/src/pages/api/revalidate.ts` are NOT deleted
- **Done when**: All 15 deleted files confirmed gone, revalidate files confirmed intact

### Phase 4: Clean Up Dead Cache Rules

- **Goal**: Remove Astro route cache rules for endpoints that no longer exist in Astro
- **Files**:
  - `app/astro.config.mjs`
  - `themes/default/astro.config.mjs`
  - `themes/minimal/astro.config.mjs`
  - `themes/bare/astro.config.mjs`
- **Steps**:
  - [ ] In `app/astro.config.mjs`: remove rules for `/api/feed.xml`, `/api/atom.xml`, `/api/sitemap.xml`
  - [ ] In each theme's `astro.config.mjs`: remove same 3 rules
- **Done when**: All 4 config files updated

### Phase 5: Build & Verify

- **Goal**: Full Go build + Astro build pass without errors
- **Steps**:
  - [ ] `cd vault && go build ./...` — verify Go compilation
  - [ ] `cd app && npm run build` — verify Astro build
  - [ ] Run feed tests: `cd vault && go test ./internal/feed/`
  - [ ] Check IDE diagnostics for any remaining issues
- **Done when**: Both builds pass, no errors

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PALETTES_ROOT path differs between Astro and Go | palette.css 404 in prod | Use same resolution order: env var → CWD → fallback. Test with same binary location |
| Deleting revalidate theme thin-shell by mistake | Cache invalidation broken for theme users | Explicitly check that `revalidate.ts` files remain after Phase 3 |
| THEMES_ROOT path resolution differs | admin/site.astro theme picker empty | Use same `VANBLOG_THEMES_DIR` env var; dispatcher already sets this in prod |
| Go code can't access `hooks/palettes/` at runtime | palette endpoints 404 | Go binary runs from project root in dev; check CWD. In Docker, path must be configured via env var |

## Rollback Strategy

If something goes wrong:

1. **Revert Go code**: `git checkout vault/internal/palette/ vault/internal/theme/ vault/main.go`
2. **Restore deleted files**: `git checkout app/src/pages/api/ themes/*/src/pages/api/`
3. **Restore config files**: `git checkout app/astro.config.mjs themes/*/astro.config.mjs`
4. **Rebuild**: `cd vault && go build ./... && cd ../app && npm run build`

All changes are localized. Rollback is safe and complete.
