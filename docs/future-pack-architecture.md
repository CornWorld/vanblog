# Future Plan: Pack Architecture

## Status

This document describes the Pack architecture and its current executable slices. It is not a runtime plugin contract.

The current implementation includes Pack v0 discovery/runtime loading, read-only lifecycle status/plan diagnostics, artifact staging and startup summaries. Later sections describe the direction for themes, the admin frontend, instance contracts, and runtime-loaded schemas; those remain separate from the current deploy executor.

## Context

Vanblog is already composed from three strong runtimes:

- PocketBase provides the BaaS: collections, auth, files, API rules, migrations and hooks.
- Astro provides blog/CMS-specialized public frontend construction and, currently, the admin frontend.
- Caddy provides ingress, TLS, maintenance fallback and route application.

The repository retains a Zod v4 model registry compiled to CJS and embedded into Go, the root `packs/` builtin source tree, fixed Astro Pack routes, and a Caddy configuration builder. Legacy plugin compatibility files have been removed; see `docs/plugin-to-pack-evolution.md` for the full architectural evolution history.

Pack does not replace those systems or duplicate their configuration. Pack is the smallest application resource unit that those systems may independently adapt.

## Core concept

A Pack is only identity plus a filesystem:

```go
type Pack struct {
    Name    string
    Version string
    FS      fs.FS
    Source  Source
}
```

`Source` distinguishes only where resources came from:

```go
type Source uint8

const (
    Builtin Source = iota
    Local
)
```

The Pack kernel is responsible only for:

1. Listing builtin and local Pack sources.
2. Validating names, versions and resource tree safety.
3. Applying whole-Pack precedence.
4. Exposing each resolved Pack source as `fs.FS`.
5. Copying builtin Pack source into a managed local source location when requested by tooling.

It does not install dependencies, build frontend assets, parse Caddy config, execute TypeScript, or repair runtime state. PocketBase, Astro, Caddy, Zod models, routes, navigation, permissions and migrations stay owned by their narrow adapters or by the dev-image builder.

## Builtin Packs are virtual

Builtin behavior is projected as virtual Packs. There is no required physical `packs/core` directory and no concrete Core Pack that owns all builtin behavior.

Builtin Packs can be backed by `embed.FS`, image files or generated resources. A local Pack with the same name replaces the builtin Pack as a whole:

```text
local bookmarks exists -> use local bookmarks
otherwise              -> use builtin bookmarks
```

Resources are not implicitly overlaid file by file. Whole-Pack replacement keeps ownership and debugging clear.

The user-facing operation is add/vendor-style customization through the Pack CLI, not by depending on internal directory names:

```text
vanblog pack list
vanblog pack inspect bookmarks
vanblog pack add bookmarks
vanblog pack validate <managed-pack-source>
```

`add` copies current builtin source into VanBlog-managed storage. It never rewrites or reruns already applied migration history; changes require a new migration. If the copied source contains frontend source that needs a build artifact, the CLI reports `needs build` and points the operator to the dev image / Pack builder workflow.

## Minimal identity file

A local Pack contains a small identity file:

```json
{
  "name": "bookmarks",
  "version": "1.0.0"
}
```

JSON is used because Go supports it in the standard library. This is identity, not a cross-system manifest.

## Pack lifecycle: source, artifact and runtime

Pack has three lifecycle layers. The names below describe internal responsibilities, not public directory contracts:

1. **Source**: author-controlled Pack files such as `pack.json`, hooks, pages and assets. Source is installed, copied or edited through `vanblog pack` tooling and, for operations that need frontend compilation or dependency checks, the VanBlog dev image.
2. **Artifact**: builder-produced runtime contract. A future Pack builder may record source hash, VanBlog version compatibility, staged hook inputs and frontend targets in generated metadata. Artifact layout is VanBlog-managed and may change.
3. **Runtime**: the production server validates artifacts, stages hooks, and serves already-built frontend targets. It never installs dependencies, never runs package-manager commands, and never builds Pack source.

Operators should not depend on inner source/artifact/runtime paths. At most, deployment exposes a VanBlog-managed data volume or bind mount that the CLI and dev-image builder understand. This keeps layout migration possible while still allowing self-hosted persistence.

Runtime behavior is deliberately one-way:

```text
valid loadable artifact -> load/stage/serve
missing or stale user artifact -> skip Pack, warn, suggest vanblog pack build via dev image
broken builtin artifact/source -> fail closed, because builtin Packs are part of the shipped product
```

This prevents cross-layer fixes during `serve`: production can diagnose and refuse unsupported content, but the tool layer is responsible for making content loadable.

### Lifecycle diagnostics and deployment preflight

The current lifecycle surface is intentionally read-only and build/deploy oriented:

```text
vanblog pack status
vanblog pack plan
vanblog pack plan <local-pack-directory>
```

`pack status` reports the resolved Pack source, version, artifact presence, source fingerprint, freshness and derived runtime state. `pack plan` adds migration ordering, target and backup preflight information. Neither command starts PocketBase, builds source, creates a backup, runs migrations, changes the active set or restarts the service.

When the production server starts, it logs a safe resolved-Pack summary containing only Pack name, version, source and derived state. A Pack skipped because its local frontend source needs a dev-image artifact receives a generic `vanblog pack build` action. Startup logs do not include source contents, resource paths, credentials or secrets.

Actual activation remains a whole-Pack deployment concern: validate source, build and validate artifacts, stage/preserve the last-known-good bundle, run migration preflight, create a PocketBase backup when migrations exist, and only then deploy/restart. v1 does not expose runtime `install`, `enable`, `disable`, `upgrade` or `uninstall` controls and never performs implicit down migrations or data deletion.

## Resource conventions

Pack authors organize source resources by user-facing purpose rather than Vanblog process topology:

```text
bookmarks/
├── pack.json
├── schema.ts
├── migrations/
├── hooks/
├── pages/
├── admin/
└── assets/
```

All entries except `pack.json` are optional. An adapter recognizes only the resources it owns.

- `schema.ts`: Zod models and inferred public types owned by the Pack.
- `migrations/`: append-only data/schema evolution.
- `hooks/`: PocketBase JS hooks.
- `pages/`: public page extensions compiled with the active public frontend.
- `admin/`: admin application extension, reserved for the later admin-SPA phase.
- `assets/`: namespaced static resources.
- `frontend/`: optional trusted build-time public contribution resources. A Pack may declare only local `frontend/` CSS/JS files with `scope: 'public'`; the host injects them into public layouts but never accepts arbitrary HTML or admin/API scope.

A full public theme may itself be an Astro project. Presence of the Astro project files is detected by the Astro adapter rather than declared through a large manifest.

## Adapter ownership

There is no common `Adapter` interface and no central `ResolvedPack` object.

Each host defines its own narrow input and result types, and consumes the resolved Pack filesystem independently:

```text
Pack kernel -> []Pack

Schema adapter    reads schema.ts
Migration adapter reads migrations/
Hook adapter      reads hooks/
Astro adapter     reads pages/ or an Astro project
Admin adapter     reads admin/
Asset adapter     reads assets/
Caddy             consumes only deployed frontend targets, not Pack files
```

This follows Go's convention of defining small interfaces at the consumer and avoids forcing Go, Node and Caddy concepts into one schema.

## Schema loading direction

Core and Pack artifacts are independent runtime sources:

```text
core schema source -> CJS artifact -> Goja
Pack schema sources -> CJS artifacts -> Goja
```

The core schema is a generated CJS runtime artifact, not a Go-embedded source. Goja consumes that artifact together with validated Pack artifacts.

The source abstraction is already explicit:

```go
type ModelSource interface {
    Load() ([]byte, error)
}
```

Resolution rules:

1. Prefer a validated external or Pack-provided resolved `schema.js` bundle when configured and loadable.
2. Load the generated core schema artifact from `--coreSchemaPath`.
3. Compile the selected CJS bundle once and validate records through fresh Goja runtimes as today.
4. Production runtime never compiles Pack TypeScript source; builders/dev images produce `schema.js` artifacts.
5. When a future control-plane builder manages external bundles, it must atomically retain the last known-good bundle if generating a replacement fails.

A control-plane builder can combine resolved Pack `schema.ts` files into one deterministic CJS artifact under the data directory or another VanBlog-managed artifact location. Record validation remains on the hot path; resolving and compiling Pack sources does not.

Runtime uses `validation.PackSource` for pre-compiled Pack `schema.js` artifacts and `ArtifactSource` for the generated core artifact. Every loadable Pack schema is loaded in stable Pack-name order; Pack-Pack and Pack-core model name collisions are fatal. Registration happens inside `OnServe` after the resolved Pack set is available and before `OnRecordValidate` can process requests.

Pack v1 adds the first tooling slice for schema artifacts: `vanblog pack build <directory>` validates a local Pack source and invokes the controlled Node/Vite schema builder to compile `schema.ts` into `schema.js`. This command belongs to the tool/dev-image layer; production `serve` still never installs dependencies, runs package-manager commands, or compiles Pack TypeScript source. The build path uses validate-then-promote: Node/Vite writes a staging file, the Go CLI validates `exports.models` with the same Goja loader used by runtime, and only then atomically renames it to `schema.js`. A bad artifact never replaces the last known-good artifact. Each Pack keeps an independent artifact; runtime logically aggregates all Pack model registries without adding a production Node/Vite step. Hash manifests, compatibility fingerprints and signed remote artifacts remain future phases.

## PocketBase resources

### Migrations

Current builtin Go migrations remain compiled into the binary during v0. Go source cannot be dynamically loaded safely and should not be presented as runtime-installable.

Local/user Packs may later use PocketBase-compatible JavaScript migrations. Migration rules are:

- Append-only after execution.
- Stable filenames/IDs.
- No automatic down migration during Pack removal.
- Adding/forking a builtin Pack source does not duplicate its builtin migration history.

### Hooks

Pack hooks are collected from `hooks/*.pb.js`, sorted by Pack and filename, and staged into the single directory consumed by the existing PocketBase JSVM. The adapter must namespace filenames, reject path escape and update the staging directory atomically.

Pack v0 keeps Packs trusted and admin/image-author controlled. It is not a JavaScript sandbox or public plugin marketplace.

## Public frontend architecture

Astro currently builds one Node SSR application containing public and admin pages. This is an implementation convenience, not the Pack contract.

The target separates three concerns:

```text
Public frontend          active theme, usually Astro
Admin frontend           stable SPA/control plane
Pack public extensions   composed into the active theme
```

### Public page extensions

A Pack may contribute namespaced pages:

```text
pages/index.astro  -> /p/<pack>
pages/[id].astro   -> /p/<pack>/:id
```

Pack v0 permits only this namespace. Packs cannot claim `/`, `/posts`, `/admin`, `/api`, `/_`, `/login`, `/setup` or other theme/core routes. This removes the need for a general route-priority language.

Page extensions are source-level code. Installing or changing them requires the tool layer to produce a compatible frontend artifact, normally through the dev image or image build pipeline. Production runtime never compiles those files and never imports frontend source from a writable data directory; if the matching artifact is missing or stale, the user Pack is skipped with a warning and a `vanblog pack build` suggestion.

The Astro adapter must generate static imports or use Astro's supported route-injection API. It must never perform request-derived dynamic imports.

### Theme host interface

Page extensions must not import a concrete Vanblog layout. The active theme provides a very small build-time host module, initially one component:

```ts
export { default as Page } from "./src/layouts/PackPage.astro";
```

Pack pages consume a generated alias/virtual module:

```astro
---
import { Page } from "vanblog:theme";
---

<Page title="Bookmarks">
  ...
</Page>
```

If a theme cannot host page extensions, the build fails with the list of affected Packs. A minimal fallback host may be provided by Vanblog for the default frontend.

### Full themes

A full theme is an independent public frontend build input, not a special collection of injected routes inside the current app. It may be SSR or static.

The Astro adapter's eventual responsibility is:

```text
one active theme
+ zero or more Pack page extensions
+ generated instance contract
-> resolved public frontend workspace/artifact
```

It does not own the admin frontend.

> **Cross-reference — implemented path (Spike 3, 2026-07-26).** The v1 full-theme implementation path landed as the **alias + `builtin-overrides` model**: every theme under `themes/{name}/` is a standard Astro project that imports the main repo's builtin via the `@vanblog/builtin/*` alias, and customises builtin files by dropping same-path overrides into `src/builtin-overrides/<rel>`. A 30-line Vite plugin `resolveId` hook in `app/integrations/themes/index.mjs` is the entire mechanism — no `injectRoute`, no submodule, no Dockerfile `cp`. The contract for what themes may override and which builtin APIs are stable (L0/L1/L2 surface) is documented in [`docs/agent-theme-architecture.md`](./agent-theme-architecture.md) §5 and §5.5; the author-facing handbook is [`docs/theme-implementer-guide.md`](./theme-implementer-guide.md). The "one active theme + Pack page extensions" composition above is realised at build time by this model: the active theme is the build input, Pack page extensions consume the theme's `PackPage.astro` host through the `vanblog:theme` virtual module, and the `packs` integration accepts a `themePage` option so the theme's host takes precedence over the builtin fallback.

### Admin direction

The admin surface is a control plane and does not need SEO or public SSR. The future direction is a stable SPA served independently from the active public theme:

```text
/api/*   -> PocketBase
/_/*     -> PocketBase
/admin/* -> Admin SPA
/*       -> active public frontend
```

Pack `admin/` resources will later compile as controlled modules into the admin SPA. They are not part of Pack v0. Until that migration, the existing Astro admin pages remain in place.

> **Cross-reference — locked at the integration layer (Spike 3).** Admin locking is no longer only a direction: it is enforced today by `app/integrations/themes/index.mjs`. The `FORBIDDEN_OVERRIDE_PATTERNS` list rejects any `src/builtin-overrides/pages/admin/**` (and `pages/api/**`, `lib/**`, `loaders/**`, `live.config.*`, `middleware.*`) file at module-resolution time — dev server and prod build both fail closed with `FORBIDDEN override: ...`. Themes therefore cannot change, extend, or replace any admin route, API endpoint, or data-layer file, even though they otherwise own their `src/` tree. See [`docs/agent-theme-architecture.md`](./agent-theme-architecture.md) §6.2 for the full forbidden-path list and [`docs/theme-implementer-guide.md`](./theme-implementer-guide.md) §7 for the author-facing rule.

## Caddy boundary

Caddy does not parse Packs and Packs do not provide raw Caddy JSON.

During Pack v0, `/p/bookmarks` is served by the existing Astro fallback and collection APIs by the existing PocketBase route, so no Pack-specific Caddy adapter is required.

Later, the deployment layer may provide Caddy with only resolved frontend targets:

```go
type Frontend struct {
    Name   string
    Target string
    Scope  Scope // public or admin
}
```

TLS, route order, reserved paths, maintenance fallback, SSRF validation and Caddy admin access remain platform-owned.

## Instance contract and npm endpoint

The admin-only npm-compatible instance contract remains a future control-plane feature. Its input is the current resolved Pack set and PocketBase schema snapshot. It is not required for runtime requests.

The endpoint may generate deterministic tarballs on demand and retain canonical schema snapshots rather than permanently store every tarball. This is outside Pack v0.

## Pack v0: executable minimum loop

`bookmarks` is the first proof because it already has:

- a compiled migration,
- a Zod model,
- a small ownership hook,
- a public fragment,
- an admin fragment,
- standard PocketBase CRUD,
- fewer shared dependencies than `moments`.

### v0 goal

Prove this flow without creating a general plugin platform:

```text
virtual builtin bookmarks Pack source
-> optional local whole-Pack source override/add
-> runtime loadability check
-> Pack hook staging
-> model source abstraction with embedded fallback
-> namespaced public Astro page extension
-> existing PocketBase API
-> existing Caddy fallback
```

### v0 explicit scope

Implement:

1. Minimal Pack kernel backed by `fs.FS`.
2. Builtin/local precedence and deterministic discovery.
3. `list`, `inspect`, `validate` and `add` service functions; expose only the minimum CLI necessary for tests and use.
4. Virtual builtin `bookmarks` resources.
5. Local `bookmarks` whole-Pack override.
6. Hook adapter and atomic staging.
7. `ModelSource` abstraction while retaining the embedded bundle as default.
8. Bookmarks public page under `/p/bookmarks`, compiled through the existing Astro app using a default `vanblog:theme` host.
9. Docker/dev wiring required for the same resolved Pack set.
10. Diagnostics that identify Pack, source and failing resource without leaking secrets.

Do not implement:

- Remote Pack installation or marketplace.
- Pack dependency solving.
- Runtime execution of Pack TypeScript.
- Dynamic third-party Zod bundle generation.
- Full themes.
- Admin SPA or Pack admin modules.
- Pack-specific Caddy routes.
- Disable/uninstall/down migration.
- Arbitrary route declarations.
- Pack permissions DSL or sandbox claims.
- Instance npm registry.

## Implementation phases

### Phase 1: Pack kernel and builtin/local resolution

**Files**:

- `vault/internal/pack/pack.go`
- `vault/internal/pack/source.go`
- `vault/internal/pack/discover.go`
- `vault/internal/pack/add.go`
- corresponding tests
- builtin bookmark resources under an embedded/default resource tree

**Actions**:

1. Implement `Pack{Name, Version, FS, Source}` and strict name/version validation.
2. Discover local Pack directories with `pack.json`, reject symlink/path escape, and sort deterministically.
3. Merge builtin and local sources using whole-Pack replacement.
4. Implement inspect/validate/add operations with atomic destination creation.

**Done when**:

- Tests cover precedence, malformed identity, duplicate names, stable ordering, path escape, existing add destination and byte-identical added resources.
- `go test ./internal/pack/...` and full Go build pass.

### Phase 2: Bookmarks PocketBase resources and model source boundary

**Files**:

- builtin bookmarks hook resources
- `vault/internal/pack/hooks.go`
- `vault/internal/validation/validation.go`
- validation tests
- `vault/main.go`
- existing bookmarks migration/model build files, changed only where ownership/wiring requires it

**Actions**:

1. Move/copy the bookmark ownership hook into the virtual Pack resource and remove duplicate runtime registration.
2. Build one atomically replaced hooks staging directory for core hooks plus resolved Pack hooks.
3. Introduce `ModelSource`; embedded models remain the default and expected v0 source.
4. Verify local Pack override changes only the resolved Pack and cannot partially merge builtin resources.

**Done when**:

- Fresh PocketBase data creates the bookmarks collection through the existing migration.
- Loaded hook fills owner for authenticated creation.
- Embedded model validation still contains the exact expected model set.
- Invalid staging or external source fails closed without corrupting the previous good state.
- Go tests/build pass.

### Phase 3: Bookmarks public Astro extension

**Files**:

- a minimal Astro Pack integration/resolver
- generated `vanblog:theme` host alias/module
- builtin bookmarks public page/component resources
- `app/astro.config.mjs`
- default theme host component
- build tests

**Actions**:

1. Spike Astro route injection with an absolute Pack `.astro` entry; document and test the chosen supported mechanism.
2. Expose only `/p/bookmarks` in v0.
3. Generate a static build-time import/route map; never load source based on request input.
4. Provide the default `Page` host through `vanblog:theme`.
5. Add Pack files to Vite watch/HMR; resource topology changes may trigger a controlled dev restart.
6. Ensure Pack styles/assets are included deterministically and production output does not require Pack frontend source.

**Done when**:

- `/p/bookmarks` is rendered by compiled Astro code rather than PB-provided raw HTML.
- The page uses the theme host and typed PocketBase data.
- Route namespace violations and duplicate page resources fail the build clearly.
- Astro check/build and an SSR smoke test pass.

### Phase 4: Delivery and closed-loop verification

**Files**:

- `Dockerfile`
- dev/prod entrypoints if hook staging requires them
- Pack integration tests

**Actions**:

1. Ensure build stages receive the same builtin/local Pack inputs.
2. Production retains only resources needed at runtime; compiled public frontend does not depend on source files.
3. Legacy plugin compatibility has been fully removed. Only the Pack path remains for bookmarks. See `docs/plugin-to-pack-evolution.md` for the complete evolution history.
4. Run fresh-data CRUD, SSR, hook, validation and routing smoke tests.

**Done when**:

- Anonymous/public and authenticated bookmark flows follow current PB rules.
- `/p/bookmarks` reaches Astro and `/api/collections/bookmarks/*` reaches PocketBase through existing Caddy ordering.
- Moving Pack frontend source away after build does not break production artifact startup.
- Go tests/build, model build/tests, Astro check/build and dev/prod smoke checks pass without new diagnostics or runtime crashes.

## Security and ownership

- v0 Packs are trusted build/deployment inputs, not sandboxed tenant uploads.
- Only administrators, the Pack CLI or image builders may select/add local Pack sources.
- Production must not execute frontend or schema source from writable `pb_data`.
- Hook staging validates containment and uses atomic replacement.
- Pack pages cannot claim security-sensitive routes.
- PocketBase API rules remain the final authorization boundary.
- Add and local override never delete data or run down migrations.

## Rollback

Pack v0 does not alter bookmark data ownership or execute down migrations. If the new public composition fails, restore the previous hooks directory and collection state while retaining the migration history and model validation. If hook staging fails, restore the existing static hooks directory. No destructive Git or database rollback is automatic.

## Pack v0 completion summary

**Status**: Completed with the explicitly documented v0 frontend restriction.

Implemented results:

- The minimal `Pack{Name, Version, FS, Source}` kernel, builtin Bookmarks Pack source, deterministic local discovery, whole-Pack replacement, inspection, source validation and add CLI are in place.
- Local Packs are snapshotted into an immutable in-memory `fs.FS`; symlinks, invalid paths, oversized resources and directory/name mismatches fail closed.
- Hook staging preserves the core hook tree, namespaces Pack hooks, uses transaction-unique staging/backup paths, and runs for `serve` through PocketBase's lifecycle instead of manually parsing Cobra flags. Each process defaults to a private runtime path; `--packRuntimeDir` permits an explicit instance-owned path.
- The builtin Bookmarks Pack is the sole owner-field hook. Legacy plugin compatibility has been fully removed (see `docs/plugin-to-pack-evolution.md`); the Moments Pack (see below) carries its own author hook at `packs/moments/hooks/moments.pb.js`.
- Validation has a replaceable `ModelSource` boundary and retains the embedded Zod bundle as the default.
- Astro injects the compiled `/p/bookmarks` route through a static entrypoint and `vanblog:theme`; Pack names follow the same strict grammar as Go.
- Docker/dev inputs include the Astro integration, builtin Pack resources and generated models.

Pack v0 accepts those files as valid source, but the production runtime does not load local frontend source directly. A local Pack containing frontend source such as `pages/`, `admin/`, `astro.config.{js,mjs,ts}` or `package.json` is skipped at runtime until a dev-image builder produces a compatible artifact. This prevents a local backend replacement from being silently combined with the builtin Astro frontend while keeping source validation honest.

Verification completed with model type/fixture/build tests, SDK TypeScript checking, full Go tests/build, Pack CLI smoke, Astro Pack tests/check/build/cache tests, Docker static build check, diff check, and a fresh temporary PocketBase runtime health/schema/staged-hook smoke. IDE diagnostics were unavailable because no IDE bridge was connected; compiler and framework diagnostics reported no new errors.

## Future phases

After v0 is stable, evaluate independently:

1. Admin SPA and Pack admin modules.
2. Full Astro theme Pack resolution and active-theme builds.
3. Remote or external artifact distribution beyond the local core-artifact and Pack-artifact build contract.
4. Admin-only instance contract/npm endpoint.
5. Signed remote Pack artifacts and installation lifecycle.
6. Pack dependency/ownership migration only when concrete use cases require it.

## Pack v1 baseline direction

Pack v1 continues to use the current `packs/` source tree. `pack.json` carries the canonical identity (`name` + `version`) plus optional Astro-facing presentation metadata (`title`, `nav`, `frontend`). This removes the earlier `pack.ts` experiment: pack metadata must stay JSON so it can be consumed by both the Go pack kernel and the Astro resolver without a TypeScript evaluator in the build hot path.

The first v1 baseline removes hard-coded `bookmarks` assumptions:

- Go builtin loading scans direct children of `packs/` and validates each Pack identity deterministically. Optional metadata fields are accepted via a strict `packMetadata` struct (`DisallowUnknownFields` still rejects typos).
- Astro integration scans `packs/*/pages/index.astro` and injects `/p/<pack>` routes at build time.
- `virtual:vanblog/packs` exposes client-safe metadata only; entrypoint paths and other server/build details stay internal to the integration.
- Pack navigation is owned by the `pack.json` `nav` field → `virtual:vanblog/packs` → `BaseLayout.astro` path. The legacy `Astro.locals.getNavItems()` / `PluginNavItem` runtime nav path is compatibility-only and should not be the source of Pack v1 public navigation.
- Palette / color appearance remains outside Pack. It should be implemented by Astro appearance libraries and Van API site appearance settings, not by Pack hooks, migrations or route adapters.

## Pack v1 validation: Moments Pack

**Status**: Completed — the v1 abstraction is reusable.

The Moments Pack (`packs/moments/`) is the second builtin Pack. It was created end-to-end (identity, Astro metadata, public route, JSVM hook, Pack-side schema bundle, production Docker build) **without any Pack-kernel code changes**, confirming that the v1 registry/discovery/resolver/validation stack generalises beyond the original `bookmarks` Pack.

Implemented results:

- `packs/moments/pack.json` — identity plus optional presentation metadata (`name`, `version`, `title`, `nav`).
- `packs/moments/pages/index.astro` — public route at `/p/moments`, auto-injected by the same integration that injects `/p/bookmarks`.
- `packs/moments/hooks/moments.pb.js` — author auto-fill hook, migrated out of `vault/pb_hooks/moments.pb.js` (the vault file is now empty). Pack hook staging picks this up automatically.
- `packs/moments/schema.ts` → `packs/moments/schema.js` — Pack-owned model validation artifact, built via the shared `scripts/pack-schema-build.mjs` and validated by `vault/internal/validation.PackSource` (Goja runtime + staging promotion) through the shared `vanblog pack build` CLI. The same builder and CLI serve both Packs.
- Production Docker: `Dockerfile` astro-build stage loops over every Pack directory and runs the schema builder when `schema.ts` exists; the prod image copies the built `/build/packs/` (with `schema.js`) into `/packs/` so the Go runtime can read each Pack's schema.
  `packs/*/schema.js` and `runtime/core-schema/models.js` are gitignored generated CJS artifacts.

Verification: same command suite as v0 (Go `test`/`build`/`vet`, Astro `test:packs`/`build`, model type/fixture tests, e2e cache, `docker buildx build --check`).
