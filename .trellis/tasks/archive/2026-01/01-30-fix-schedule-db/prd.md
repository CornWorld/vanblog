# Fix: ScheduleModule and Database Auto-Migration

## Issues to Fix

### Issue 1: ScheduleModule Reflector Dependency

`@nestjs/schedule` module's `SchedulerMetadataAccessor` cannot access `Reflector` provider in NestJS 11.

**Current workaround**: ScheduleModule is disabled
**Impact**: Cron jobs not working (AnalyticsCacheService cache updates)

**Solution**: Use manual `setInterval` instead of `@Cron` decorators

### Issue 2: Database Schema Not Auto-Created

Development environment doesn't automatically create database tables.

**Current workaround**: Manual `pnpm db:push`
**Solution**: Add automatic db:push in `createDatabaseConnection()`

## Requirements

1. Replace `@Cron` decorators with manual `setInterval` in affected services
2. Add automatic database schema creation for development environment
3. Verify E2E tests still pass after changes
4. Run lint and type check

## Files to Modify

- `src/shared/cache/analytics-cache.service.ts` - Replace @Cron with setInterval
- `src/modules/demo/demo.service.ts` - Check and replace @Cron if present
- `src/database/connection.ts` - Add automatic db:push for development
- `src/app.module.ts` - Re-enable ScheduleModule or remove import

## Acceptance Criteria

- [x] ScheduleModule import removed (no longer needed)
- [x] Cron jobs replaced with manual setInterval
- [x] Database schema auto-creates in development
- [x] E2E tests pass (149/149)
- [x] Lint passes
- [x] Type check passes (TypeScript compiled successfully)

## Implementation Summary

### Changes Made

1. **`src/shared/cache/analytics-cache.service.ts`**
   - Replaced `@Cron` decorators with manual `setInterval`
   - Implemented `OnModuleInit` for interval setup
   - Implemented `onModuleDestroy` for cleanup
   - Added proper void handling for setInterval callbacks

2. **`src/modules/demo/demo.service.ts`**
   - Replaced `@Cron('0 */6 * * *')` with manual `setInterval` (6 hours)
   - Implemented `OnModuleInit` and `OnModuleDestroy` lifecycle hooks
   - Added interval cleanup in `onModuleDestroy`

3. **`src/database/connection.ts`**
   - Added `ensureDatabaseSchema()` function for automatic db:push
   - Checks for database file and `site_meta` table existence
   - Runs `pnpm db:push` automatically in development environment for local driver

4. **`src/app.module.ts`**
   - ScheduleModule import removed (no longer needed)

### Test Results

- **Unit Tests**: 3959 passed, 6 skipped (220 test files)
- **E2E Tests**: 149 passed (30 test files)
- **Lint**: All checks passed
- **Server Startup**: Verified successful startup

### Notes

- The `setInterval` approach is more reliable than `@Cron` decorators in NestJS 11
- The `ensureDatabaseSchema()` function uses synchronous `execSync` which is acceptable during startup
- Demo mode interval cleanup prevents memory leaks on module destroy
