# Fix: Login Page Input Value Accumulation Bug

## Problem

Login form input fields accumulate values instead of replacing them:

- User enters "admin" → value becomes "admin"
- User clears and enters "admin" again → value becomes "adminadmin"
- Multiple submissions result in "adminadmin123adminAdmin@123"

## Root Cause

The input field's value is not being properly cleared/reset between form submissions or re-renders.

## Requirements

1. Fix input value accumulation on the username field
2. Fix input value accumulation on the password field
3. Ensure form resets properly on failed login attempt
4. Verify login works with credentials: admin / Admin@123

## Acceptance Criteria

- [ ] Input fields clear properly on form submit
- [ ] Login works with correct credentials
- [ ] Error messages display correctly without undefined values
- [ ] No "Cannot read properties of undefined (reading 'toLowerCase')" error

## Test Data

- Username: `admin`
- Password: `Admin@123` (created via /api/v2/public/init)
