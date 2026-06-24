# Task: server-ng-integration-test

## Overview

This task focuses on comprehensive integration testing between server-ng (backend) and the admin/website frontends following the server migration from the legacy Mongoose-based server to the new Drizzle ORM-based server-ng.

The goal is to verify that:

1. API contracts defined in `@vanblog/shared` work correctly
2. Frontend clients can successfully communicate with server-ng
3. End-to-end user workflows function as expected

## Requirements

### 1. API Contract Validation

- Verify all ts-rest contracts match actual server-ng responses
- Test request/response schema validation
- Validate error handling and status codes
- Ensure type safety across the stack

### 2. Admin-to-Backend Integration Tests

Create E2E tests for admin workflows:

- User login and authentication
- Article CRUD operations (create, read, update, delete, publish)
- Media upload and management
- Category and tag management
- System settings updates
- Plugin enable/disable functionality

### 3. Website Public API Integration Tests

Create E2E tests for public workflows:

- Article listing (pagination, filtering)
- Article detail view
- Search functionality
- Timeline API
- Bootstrap API (config, theme, navigation)

### 4. Cross-Contract Workflow Tests

Test complete user journeys:

- **Publishing Workflow**: Admin login → Create article → Upload media → Add tags → Publish → Verify on website
- **Draft Management**: Create draft → Save → Edit → Publish → Verify public visibility
- **Settings Propagation**: Update settings in admin → Verify bootstrap API response
- **Plugin Workflow**: Enable plugin → Configure → Verify functionality on website

### 5. Client Compatibility Testing

- Verify admin ts-rest client (`/api/v2`) works with server-ng
- Verify website ts-rest client (`/api`) works with server-ng
- Test authentication (Bearer token) flow
- Validate error handling in frontend clients

## Acceptance Criteria

- [ ] All new E2E tests pass in isolation
- [ ] All new E2E tests pass together (sequential execution)
- [ ] Test coverage includes at least 5 core user workflows
- [ ] All API contracts validated against actual server responses
- [ ] Frontend clients can successfully authenticate and perform CRUD operations
- [ ] Tests are documented with clear descriptions
- [ ] Database cleanup works correctly between tests
- [ ] No flaky tests due to timing or database conflicts

## Technical Notes

### Testing Framework

- **Vitest** for E2E tests (server-ng)
- Configuration: `packages/server-ng/vitest.config.e2e.ts`
- Sequential execution required (database conflicts)
- Per-worker SQLite databases for isolation

### Test Utilities Available

- `createTestApp()`: Creates NestJS testing module
- `createUser()`: Inserts test user with hashed password
- `createAuthToken()`: Performs login to get JWT token
- `cleanupDatabase()`: Deletes all test data and resets sequences
- Custom `request.auth()` method for Bearer token authentication

### API Contract Pattern

- **Backend**: Uses `@TsRestHandler()` decorator with contracts
- **Frontend**: Uses `initClient(contract, { baseUrl })`
- **Contracts**: Defined in `packages/shared/src/contracts/`
- **Admin baseUrl**: `/api/v2`
- **Website baseUrl**: `/api`

### Reference Test Files

- `packages/server-ng/test/workflows/article-publishing.e2e-spec.ts` - Workflow test pattern
- `packages/server-ng/test/app.e2e-spec.ts` - Basic E2E test pattern
- `packages/server-ng/test/test-utils.ts` - Test utilities

### Key Considerations

1. **Database Isolation**: Each test must clean up after itself
2. **Authentication**: Tests should use `createAuthToken()` for authenticated requests
3. **Sequential Execution**: E2E tests run sequentially to avoid database conflicts
4. **Realistic Data**: Use realistic data matching production scenarios
5. **Error Cases**: Test both success and failure scenarios

## Out of Scope

- Frontend UI testing (use Playwright for admin UI tests separately)
- Performance/load testing (separate task)
- Legacy server compatibility (testing only for server-ng)
- Third-party service integration (e.g., email providers, OAuth)
- Client-side rendering tests (React component testing)
