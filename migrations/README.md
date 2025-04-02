# Database Migrations

This folder contains SQL migration scripts for the database schema changes.

## How to Apply Migrations

1. Log in to your Supabase dashboard
2. Go to the SQL Editor section
3. Create a new query
4. Copy and paste the content of the migration file you want to apply
5. Run the query

## Available Migrations

### add_active_column.sql

This migration adds an `active` boolean column to both the `groups` and `leaders` tables with a default value of `true`. This enables "soft deletion" functionality, where instead of completely removing records, we mark them as inactive.

**What this migration does:**

1. Adds the `active` column (boolean) to the `groups` table with a default value of `true`
2. Adds the `active` column (boolean) to the `leaders` table with a default value of `true`
3. Sets comments on both columns to explain their purpose
4. Updates any existing rows to have `active = true` if the value is `NULL`

After applying this migration, you'll be able to:
- Filter groups/leaders by their active status
- Deactivate groups/leaders instead of deleting them
- Reactivate previously deactivated groups/leaders

### fix_duplicates_add_constraints.sql

This migration fixes duplicate leaders in the database and adds unique constraints to prevent future duplicates. It also ensures each university can have multiple leaders, but each leader can only have one active group per university.

**What this migration does:**

1. **For Leaders:**
   - Removes duplicate leaders, keeping only the first instance of each email
   - Adds a unique constraint on email (case insensitive) to prevent future duplicates

2. **For Groups:**
   - Adds a `leader_id` column to store a direct reference to the leader
   - Creates a unique constraint on the combination of university + leader_id
   - Deactivates any duplicate university + leader combinations, keeping only the most recently updated one active

**Important Notes:**
- This migration will automatically resolve duplicates, but you should review the data afterward
- The `leader_id` column is added to improve data integrity, but the existing `leader` JSON object is still maintained for compatibility
- The unique constraint only applies to active groups, allowing you to have inactive duplicates if needed 