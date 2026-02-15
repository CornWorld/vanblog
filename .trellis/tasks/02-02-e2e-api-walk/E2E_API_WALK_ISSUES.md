# E2E API Walk - Issues Found & Resolved

**Date**: 2026-02-13 ~ 2026-02-14
**Environment**:

- Admin: http://localhost:3003/admin
- Server: http://localhost:3050/api
- Database: SQLite (vanblog.db)

---

## Issues Found & Resolved

### 1. ✅ FIXED: Settings API Routes (404) — ts-rest Route Doubling

**Root Cause**: `@TsRestHandler(contract.xxx)` internally applies `@Get(route.path)` using the contract's full path (e.g., `/v2/settings/site-info`). Combined with `@Controller({ path: 'settings', version: '2' })` + global prefix `/api`, paths doubled to `/api/v2/settings/v2/settings/site-info`.

**Fix**: Removed all `@TsRestHandler` methods from `SettingCoreController`, converted to standard NestJS `@Get/@Patch` decorators with explicit paths.

**Files**: `packages/server-ng/src/modules/setting/setting-core.controller.ts`

---

### 2. ✅ FIXED: Plugin API Permission Error (403)

**Root Cause (Part 1)**: Static route `@Get('failed')` was declared after parameterized route `@Get(':name')`, causing NestJS to match `failed` as a `:name` param and hitting the wrong handler.

**Fix**: Reordered routes in `PluginsController` — static routes before parameterized routes.

**Files**: `packages/server-ng/src/modules/plugin/controllers/plugins.controller.ts`

---

### 3. ✅ FIXED: ts-rest Route Doubling Bug — 20 Controllers, 59 Methods

**Root Cause**: Same as Issue #1. All controllers using `@TsRestHandler` had doubled route paths.

**Fix Strategy**:

- Controllers with standard NestJS equivalents: deleted ts-rest duplicate methods
- Controllers only using ts-rest: converted to standard NestJS decorators

**Affected Controllers** (20 total):

- AppController, PipelineController, DraftController, ApiTokenController, CategoryController
- TimelineController, IsrController, CompatibilityController, ArticleController, TagController
- UserController, AuthController, AnalyticsController, BackupController
- SitemapController, RssController, DraftVersionController, CaddyController, CustomPagesAdminController

**Stats**: 39 files changed, +1138 -3826 lines (net -2688 lines)

---

### 4. ✅ FIXED: PermissionService Vite ESM Multi-Instance Issue

**Root Cause**: Vite dev mode loads the same file as multiple ESM module instances. `PermissionService` stored its state (modulePermissions, predefinedRoles, etc.) as instance-level `Map`s. The NestJS DI container and PermissionsGuard injected different instances of the "same" service.

**Symptoms**: `PermissionsGuard` returned 403 for all protected endpoints. Debug endpoint showed `knownPermissionsCount: 0`, `modulePermissions: []`, `predefined admin role: []` despite bootstrap logs confirming 57 permissions were registered.

**Fix**: Stored `PermissionService` core state in `globalThis` using `Symbol.for` keys (same pattern used for `contributePermissions`).

**Files**:

- `packages/server-ng/src/modules/permission/permission.service.ts`
- `packages/server-ng/src/modules/permission/permission-collection.service.ts` (prior fix)

---

### 5. Remaining: LegacyRouteConverter Warning

**Log**: `[LegacyRouteConverter] Unsupported route path: "/rss/(.*)"` — RSS excluded from global prefix via pattern `/rss/(.*)` which triggers a deprecation warning. Non-blocking.

---

## Final API Walk Results — 30/30 PASS

| #   | Method | Endpoint                              | Status | Module       |
| --- | ------ | ------------------------------------- | ------ | ------------ |
| 1   | GET    | `/api/v2`                             | ✅ 200 | App          |
| 2   | GET    | `/api/v2/public/admin`                | ✅ 200 | Public       |
| 3   | GET    | `/api/v2/public/timeline`             | ✅ 200 | Public       |
| 4   | GET    | `/api/v2/auth/profile`                | ✅ 200 | Auth         |
| 5   | GET    | `/api/v2/categories`                  | ✅ 200 | Category     |
| 6   | GET    | `/api/v2/tags`                        | ✅ 200 | Tag          |
| 7   | GET    | `/api/v2/articles?page=1&pageSize=10` | ✅ 200 | Article      |
| 8   | GET    | `/api/v2/drafts`                      | ✅ 200 | Draft        |
| 9   | GET    | `/api/v2/pipelines`                   | ✅ 200 | Pipeline     |
| 10  | GET    | `/api/v2/tokens`                      | ✅ 200 | API Token    |
| 11  | GET    | `/api/v2/admin/users`                 | ✅ 200 | User         |
| 12  | GET    | `/api/v2/admin/users/profile/me`      | ✅ 200 | User         |
| 13  | GET    | `/api/v2/admin/plugins`               | ✅ 200 | Plugin       |
| 14  | GET    | `/api/v2/admin/media`                 | ✅ 200 | Media        |
| 15  | GET    | `/api/v2/admin/analytics/overview`    | ✅ 200 | Analytics    |
| 16  | GET    | `/api/v2/settings/site-info`          | ✅ 200 | Setting      |
| 17  | GET    | `/api/v2/settings/layout`             | ✅ 200 | Setting      |
| 18  | GET    | `/api/v2/settings/theme`              | ✅ 200 | Setting      |
| 19  | GET    | `/api/v2/settings/navigation`         | ✅ 200 | Setting      |
| 20  | GET    | `/api/v2/analytics/viewers/public`    | ✅ 200 | Analytics    |
| 21  | GET    | `/api/v2/backup`                      | ✅ 200 | Backup       |
| 22  | GET    | `/api/v2/backup/export`               | ✅ 200 | Backup       |
| 23  | GET    | `/api/v2/sitemap/status`              | ✅ 200 | Sitemap      |
| 24  | GET    | `/v2/rss/status`                      | ✅ 200 | RSS\*        |
| 25  | GET    | `/api/v2/custom-pages`                | ✅ 200 | Custom Pages |
| 26  | GET    | `/api/v2/health`                      | ✅ 200 | Health       |
| 27  | GET    | `/api/v2/admin/caddy/config`          | ✅ 200 | Caddy        |
| 28  | GET    | `/api/v2/admin/caddy/logs`            | ✅ 200 | Caddy        |
| 29  | POST   | `/api/v2/admin/isr/trigger`           | ✅ 201 | ISR          |
| 30  | GET    | `/api/v2/permissions/debug`           | ✅ 200 | Permission   |

\*RSS routes excluded from `/api` prefix (public XML feeds), path is `/v2/rss/...` not `/api/v2/rss/...`

---

## Route Path Reference

Some controllers use non-obvious paths. Reference for frontend:

| Module            | Controller Path                    | API Prefix | Notes                           |
| ----------------- | ---------------------------------- | ---------- | ------------------------------- |
| Users             | `/api/v2/admin/users`              | admin/     | User CRUD under admin namespace |
| Media             | `/api/v2/admin/media`              | admin/     | Media under admin namespace     |
| API Tokens        | `/api/v2/tokens`                   | -          | No `api-tokens`, just `tokens`  |
| Auth Profile      | `/api/v2/auth/profile`             | -          | Not `auth/me`                   |
| Analytics Viewers | `/api/v2/analytics/viewers/public` | -          | No `admin/` prefix              |
| Backup            | `/api/v2/backup`                   | -          | No `admin/` prefix              |
| Sitemap           | `/api/v2/sitemap`                  | -          | No `admin/` prefix              |
| RSS               | `/v2/rss/...`                      | -          | Excluded from `/api` prefix     |
| Custom Pages      | `/api/v2/custom-pages`             | -          | No `admin/` prefix              |
| Health            | `/api/v2/health`                   | -          | No `admin/` prefix              |
