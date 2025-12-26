# Schema Usage Verification Report - server-ng Contracts

## Task: Verify server-ng uses fixed schemas from @vanblog/shared

Generated: 2025-12-26

## Summary

**Status**: ✅ VERIFIED - All major contracts are correctly using fixed schemas from @vanblog/shared/runtime/schema.ts

### Key Findings

1. **Permission Contracts** ✅
   - Contract file: `/packages/shared/src/contracts/permission.contract.ts`
   - Imports: `PermissionNode`, `PermissionNodeReq`, `PermissionNodePatch`, `PermissionGroup`, `PermissionGroupReq`, `PermissionGroupPatch` from `runtime/schema.js`
   - All schemas defined in `@vanblog/shared/runtime/schema.ts` (lines ~350-380)
   - **Note**: Permission controller in server-ng is NOT using ts-rest contracts yet (using legacy DTO approach)

2. **User Contracts** ✅
   - Contract file: `/packages/shared/src/contracts/user.contract.ts`
   - Imports: `User`, `UserReq`, `UserPatch`, `DeleteResponse` from `runtime/schema.js`
   - All schemas properly defined in runtime schema
   - Controller using ts-rest handler: `user.controller.ts` with `@TsRestHandler(contract.create/list/update/delete)`

3. **Article Contracts** ✅
   - Contract file: `/packages/shared/src/contracts/article.contract.ts`
   - Imports: `Article`, `ArticleReq`, `ArticlePatch`, `ArticleList`, `ArticleQuery`, `SearchQuery`, `DeleteResponse`, `PasswordVerifyReq`, `PasswordVerifyResp` from `runtime/schema.js`
   - All schemas defined in runtime schema
   - Controller using ts-rest handler: `article.controller.ts` with `@TsRestHandler(contract.findAll/create/update/remove)`

4. **Draft Contracts** ✅
   - Contract file: `/packages/shared/src/contracts/draft.contract.ts`
   - Imports: `Draft`, `DraftReq`, `DraftPatch`, `DraftList`, `Article`, `PaginationQuery`, `DeleteResponse` from `runtime/schema.js`
   - All schemas defined in runtime schema
   - Controller using ts-rest handler: `draft.controller.ts` with `@TsRestHandler(contract.getDrafts/createDraft/updateDraft)`

## Detailed Schema Mapping

### Permission Schemas

```
Database Layer:
- $PermissionNode (selectPermissionNodeSchema)
- $PermissionNodeIns (insertPermissionNodeSchema)
- $PermissionNodeUpd (updatePermissionNodeSchema)
- $PermissionGroup (selectPermissionGroupSchema)
- $PermissionGroupIns (insertPermissionGroupSchema)
- $PermissionGroupUpd (updatePermissionGroupSchema)

API Layer (runtime/schema.ts):
- PermissionNode = $PermissionNode (omits sensitive fields)
- PermissionNodeReq = $PermissionNodeIns (without id, timestamps)
- PermissionNodePatch = $PermissionNodeUpd (without id, timestamps, partial)
- PermissionGroup = $PermissionGroup
- PermissionGroupReq = $PermissionGroupIns (without id, timestamps)
- PermissionGroupPatch = $PermissionGroupUpd (without id, timestamps, partial)
```

### User Schemas

```
Database Layer:
- $User (selectUserSchema)
- $UserIns (insertUserSchema)
- $UserUpd (updateUserSchema)

API Layer (runtime/schema.ts):
- User = $User.omit({ password: true })
- UserReq = $UserIns.omit({ id, createdAt, updatedAt, ... })
- UserPatch = $UserUpd (partial, sensitive fields omitted)
```

### Article Schemas

```
Database Layer:
- $Article (selectArticleSchema)
- $ArticleIns (insertArticleSchema)
- $ArticleUpd (updateArticleSchema)

API Layer (runtime/schema.ts):
- Article = $Article
- ArticleReq = $ArticleIns (without id, timestamps)
- ArticlePatch = $ArticleUpd (without id, timestamps, partial)
- ArticleList = z.object({ items: z.array(Article), total: z.number(), ... })
- ArticleQuery = z.object({ page, pageSize, category, tag, ... })
```

### Draft Schemas

```
Database Layer:
- $Draft (selectDraftSchema)
- $DraftIns (insertDraftSchema)
- $DraftUpd (updateDraftSchema)

API Layer (runtime/schema.ts):
- Draft = $Draft
- DraftReq = $DraftIns (without id, timestamps)
- DraftPatch = $DraftUpd (without id, timestamps, partial)
- DraftList = z.object({ items: z.array(Draft), total: z.number(), ... })
```

## Controllers Using ts-rest

**Currently using contracts** (14 controllers):

- analytics/analytics.controller.ts
- article/article.controller.ts ✅
- auth/auth.controller.ts ✅
- auth/login-log.controller.ts ✅
- category/category.controller.ts ✅
- draft/draft-version.controller.ts ✅
- draft/draft.controller.ts ✅
- health/health.controller.ts ✅
- public/meta.controller.ts ✅
- public/timeline.controller.ts ✅
- rss/rss.controller.ts ✅
- setting/setting-core.controller.ts ✅
- tag/tag.controller.ts ✅
- user/user.controller.ts ✅

**NOT using ts-rest contracts** (Legacy):

- permission/permission.controller.ts ❌ (Uses DTO classes, not ts-rest)

## Missing Items

### Pipeline Schemas ❌

- **Status**: NOT IMPLEMENTED
- **Location**: `packages/shared/src/runtime/db.ts` has `pipelines` table definition (lines ~880-915)
- **Issue**: Pipeline schemas NOT exported from `runtime/schema.ts`
- **Required**:
  - Add `$Pipeline`, `$PipelineIns`, `$PipelineUpd` schemas to `runtime/schema.ts`
  - Create `packages/shared/src/contracts/pipeline.contract.ts`
  - Export pipeline contract from `contracts/index.ts`
  - Migrate pipeline controller to use ts-rest

## Recommendations

### High Priority

1. **Create Pipeline Schemas & Contract**
   - Add schemas to `runtime/schema.ts` following the pattern of User/Article/Draft
   - Create `pipeline.contract.ts` with full CRUD operations
   - Update pipeline controller to use ts-rest handler

2. **Migrate Permission Controller**
   - Replace DTO classes with ts-rest contract handler
   - Update permission.controller.ts to use `@TsRestHandler(permissionContract.createNode, etc.)`
   - Remove legacy DTO approach

### Medium Priority

3. **Schema Import Paths Verification**
   - All contracts correctly import from `../runtime/schema.js`
   - All imports use proper file extensions (.js for ESM)
   - Zod validation rules properly applied

### Low Priority

4. **Documentation**
   - Document pipeline schema structure
   - Update CLAUDE.md with pipeline contract info
   - Ensure all DTOs in server-ng match corresponding shared schemas

## Files Affected

### Files Verified ✅

- `/packages/shared/src/contracts/permission.contract.ts`
- `/packages/shared/src/contracts/user.contract.ts`
- `/packages/shared/src/contracts/article.contract.ts`
- `/packages/shared/src/contracts/draft.contract.ts`
- `/packages/shared/src/runtime/schema.ts` (verified schema exports)
- `/packages/shared/src/runtime/db.ts` (verified table definitions)

### Files Needing Changes

- `/packages/shared/src/runtime/schema.ts` - ADD pipeline schemas
- `/packages/shared/src/contracts/pipeline.contract.ts` - CREATE NEW
- `/packages/shared/src/contracts/index.ts` - ADD pipeline export
- `/packages/server-ng/src/modules/permission/permission.controller.ts` - MIGRATE to ts-rest
- `/packages/server-ng/src/modules/pipeline/pipeline.controller.ts` - MIGRATE to ts-rest

## Test Coverage

All schema usage is validated through:

- Contract type checking at compile time
- Zod validation at runtime (request body validation)
- ts-rest handler enforces schema contracts
- Type inference from Zod schemas to Drizzle tables (single source of truth)
