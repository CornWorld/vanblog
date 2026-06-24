# Task: Server-NG Integration Testing

## Goal

Test server-ng integration with admin/website frontends after server migration from legacy Mongoose-based server to Drizzle ORM-based server-ng.

## Requirements

### 1. Verify Existing E2E Tests Pass

- Run all existing E2E tests in server-ng
- Verify they still pass after migration
- Document any failures

### 2. API Contract Validation

- Verify ts-rest contracts match server-ng responses
- Test key endpoints (auth, article, draft, media)

### 3. Integration Test Scenarios

Test the following workflows:

**Admin to Server-NG:**

- Login authentication flow
- Article CRUD (create, read, update, delete)
- Media upload
- Draft to publish workflow

**Public API:**

- Article listing (pagination)
- Article detail view
- Search functionality
- Bootstrap API

### 4. Cross-Layer Verification

- Settings change in admin → verify on public API
- Article publish → verify on website

## Acceptance Criteria

- [x] All existing E2E tests pass (149/149)
- [x] Document test results
- [x] Identify any integration issues

## Issues Found

### Issue 1: ScheduleModule Reflector Dependency (BLOCKING)

- **Status**: Temporarily disabled (commented out in app.module.ts)
- **Impact**: Cron jobs not working (AnalyticsCacheService, DemoService)
- **Fix Required**: Alternative approach or framework bug report

### Issue 2: Database Schema Not Auto-Created

- **Status**: Fixed by running `pnpm db:push` manually
- **Recommendation**: Add automatic db:push for development environment

## Technical Notes

- **E2E Test Config**: `packages/server-ng/vitest.config.e2e.ts`
- **Test Utilities**: `packages/server-ng/test/test-utils.ts`
- **Test Command**: `pnpm --filter @vanblog/server-ng test:e2e`
- **API Contracts**: `packages/shared/src/contracts/`

## Out of Scope

- Frontend UI testing (use Playwright separately)
- Performance/load testing
