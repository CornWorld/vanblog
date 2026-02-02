# E2E Verification: Walk all server-ng APIs via admin DOM

## Background

After fixing the login form bug, we need to verify that all APIs between admin (frontend) and server-ng (backend) are working correctly. This task involves systematically walking through all accessible API endpoints by interacting with the admin UI DOM.

## Requirements

### Primary Goal

Verify all server-ng APIs are accessible and functional through the admin interface by:

1. **Authentication & User Management**
   - Login/Logout flow
   - User profile viewing
   - Collaborator management

2. **Content Management**
   - Article CRUD (Create, Read, Update, Delete)
   - Draft management
   - Category CRUD
   - Tag CRUD
   - Custom page management

3. **Media Management**
   - Image upload
   - Image listing
   - Image deletion

4. **System Settings**
   - Site info configuration
   - SEO settings
   - Layout settings
   - Comment system (Waline) configuration
   - Caddy configuration
   - Backup/restore

5. **Data & Analytics**
   - Welcome dashboard loading
   - Log viewing
   - Analytics data

### Method

Use Chrome DevTools MCP to:

1. Navigate to each admin page
2. Take snapshots to verify page loads
3. Interact with forms and buttons
4. Check network requests for API calls
5. Verify responses are correct

## Acceptance Criteria

- [ ] All main navigation items accessible
- [ ] Login flow works (username/password → submit → redirect)
- [ ] Welcome/Dashboard page loads with user data
- [ ] Article list page loads
- [ ] Article editor opens (new and existing)
- [ ] Draft list page loads
- [ ] Image management page loads
- [ ] Category management page loads
- [ ] Tag management page loads
- [ ] System settings tabs load:
  - [ ] Site Info
  - [ ] User Management
  - [ ] Image Settings
  - [ ] Waline
  - [ ] Plugin
  - [ ] Caddy
  - [ ] Advanced
  - [ ] Migration
  - [ ] Backup
  - [ ] Token
- [ ] Data management page loads
- [ ] Log management page loads
- [ ] Comment management page loads
- [ ] Pipeline page loads

## Success Metrics

- Zero 404 errors on API calls
- All pages render without JavaScript errors
- Authentication state persists across navigation
- Forms can be submitted successfully

## Notes

- Use the Chrome DevTools MCP tools
- Start from http://localhost:3002/admin/user/login
- Test credentials: admin / admin123
- Document any failures with specific API endpoint and error message
