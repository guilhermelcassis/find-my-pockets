# Database Migration Guide

This guide outlines the steps to migrate your Supabase database from the old schema to the new one, removing deprecated fields and ensuring all data is preserved.

## ⚠️ Important Warning

**This migration includes destructive changes that permanently remove columns from your database.** Make sure to follow these steps carefully and create backups before proceeding.

## Migration Steps

### 1. Run Database Cleanup Report

First, run the diagnostic report to understand the current state of your database:

```sql
-- migrations/database_cleanup_report.sql
```

Check the output to confirm:
- The total number of groups in your database
- How many groups have meeting times data
- How many groups might need migration (missing meetingTimes array data)
- How many groups have NULL tipo values that need to be set

### 2. Backup Your Database

Before making any permanent changes, create a full backup of your Supabase database using the Supabase dashboard.

### 3. Run the Migration Script

Run the full migration script that will:
1. Migrate existing meeting time data to the meetingTimes array
2. Set default 'Publica' value for any NULL tipo fields
3. Make the tipo column required (NOT NULL)
4. Create a backup view of the original data
5. Remove the deprecated columns (name, dayofweek, time, local)

```sql
-- migrations/remove_deprecated_fields.sql
```

### 4. Update Your Code

Deploy your updated application code with the following changes:
- Updated Group interface without deprecated fields
- Form handling code that doesn't reference deprecated fields
- UI components that use the meetingTimes array instead of deprecated fields

### 5. Verify the Migration

After deploying the changes:
1. Test adding new groups to ensure they save correctly
2. Verify existing groups display properly with their meeting times
3. Confirm that all required fields (tipo) are working as expected

## Rollback Plan

If issues occur, you can temporarily restore access to the old data using the backup view:

```sql
SELECT * FROM groups_pre_migration_backup;
```

For a full rollback, you would need to restore from the backup created in step 2.

## Field Changes Summary

### Removed Fields
- `name` - Removed (university field now serves as primary identifier)
- `dayofweek` - Removed (replaced by meetingTimes array)
- `time` - Removed (replaced by meetingTimes array)
- `local` - Removed (replaced by meetingTimes array)

### Required Fields
- `tipo` - Now required (NOT NULL), defaults to 'Publica'

### New Structure for Meeting Times
Meeting times are now stored exclusively in the meetingTimes array, with each meeting time containing:
- dayofweek
- time
- local (optional) 