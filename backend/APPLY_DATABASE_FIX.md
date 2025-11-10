# Database Fix for Profile Update Error

## Problem Summary

The profile update was failing with this error:
```
error: invalid input syntax for type json
Expected ":", but found "}"
JSON data, line 1: {"3"}
```

## Root Causes Found

1. **JSON.stringify Issue**: The `audit_logs.details` column is JSONB but code was passing `JSON.stringify(profileData)` ✅ **FIXED**
2. **Wrong Column Type**: The `users.selected_agent_ids` column is JSONB but should be INTEGER[] ⚠️ **NEEDS FIX**

## What Was Fixed

### 1. Code Fix (Already Applied ✅)
- **File**: `backend/src/routes/profile.ts`
- **Change**: Removed `JSON.stringify()` call when inserting into audit_logs
- **Status**: Built and compiled

### 2. Schema Documentation (Already Updated ✅)
- **File**: `backend/src/models/schema.sql`
- **Changes**:
  - Added `locations` table definition
  - Updated `users` table to include `location_id` and `selected_agent_ids INTEGER[]`
  - Updated `agents` table to include `location_id`
  - Added proper indexes

## What Needs To Be Done

### Run the Database Type Fix

The `selected_agent_ids` column is currently **JSONB** but needs to be **INTEGER[]**.

**Run this command:**
```bash
cd backend
node run-type-fix.js
```

This script will:
1. Check current column type
2. Convert `selected_agent_ids` from JSONB to INTEGER[]
3. Migrate any existing data
4. Verify the change

### Restart Backend

After running the fix, restart your backend server:
```bash
# Stop current backend (Ctrl+C)
# Then start it again
npm run dev
```

## Verification

After the fix, the profile update should work correctly. The error will be gone because:
1. ✅ `audit_logs.details` receives proper object (not stringified)
2. ✅ `users.selected_agent_ids` is INTEGER[] (not JSONB)

## Files Created for Reference

- `fix-profile-schema.sql` - Adds locations table and columns
- `fix-selected-agents-type.sql` - Converts JSONB to INTEGER[]
- `run-type-fix.js` - Script to run the type conversion
- `check-and-migrate.js` - Script to check database state

## Quick Check

To verify current database state:
```bash
node check-and-migrate.js
```

This will show if `selected_agent_ids` is still JSONB or has been converted to INTEGER[].

