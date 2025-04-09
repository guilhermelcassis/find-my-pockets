-- Migration to fully remove deprecated fields from groups table
-- Run this script in your Supabase SQL editor
-- WARNING: This is a destructive operation. Make sure you have backed up your data first.

-- First, make sure all meetingTimes arrays are populated from legacy fields
DO $$
BEGIN
  -- Check if there are any groups with legacy fields that need migration
  IF EXISTS (
    SELECT 1 FROM groups 
    WHERE (dayofweek IS NOT NULL AND dayofweek != '') 
    AND (time IS NOT NULL AND time != '')
    AND ("meetingTimes" IS NULL OR jsonb_array_length("meetingTimes") = 0)
  ) THEN
    -- Migrate legacy fields to meetingTimes array
    UPDATE groups
    SET "meetingTimes" = jsonb_build_array(
      jsonb_build_object(
        'dayofweek', dayofweek,
        'time', time,
        'local', COALESCE(local, '')
      )
    )
    WHERE 
      (dayofweek IS NOT NULL AND dayofweek != '') AND
      (time IS NOT NULL AND time != '') AND
      ("meetingTimes" IS NULL OR jsonb_array_length("meetingTimes") = 0);
      
    RAISE NOTICE 'Migrated legacy meeting time fields to meetingTimes array';
  END IF;
END $$;

-- Make sure tipo is set for all groups
UPDATE groups 
SET tipo = 'Publica' 
WHERE tipo IS NULL OR tipo = '';

-- Make tipo required (NOT NULL) if not already
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'tipo' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE groups ALTER COLUMN tipo SET NOT NULL;
    RAISE NOTICE 'Made tipo field required (NOT NULL)';
  END IF;
END $$;

-- Create a backup view of the original table structure before dropping columns
DO $$
BEGIN
  EXECUTE 'DROP VIEW IF EXISTS groups_pre_migration_backup';
  EXECUTE 'CREATE VIEW groups_pre_migration_backup AS SELECT * FROM groups';
  RAISE NOTICE 'Created backup view groups_pre_migration_backup with original data';
END $$;

-- Now drop the deprecated columns
DO $$
BEGIN
  -- Count before dropping
  RAISE NOTICE '======= DROPPING DEPRECATED COLUMNS =======';
  
  -- Drop name column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'name'
  ) THEN
    ALTER TABLE groups DROP COLUMN name;
    RAISE NOTICE 'Dropped name column';
  ELSE
    RAISE NOTICE 'name column already removed';
  END IF;
  
  -- Drop dayofweek column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'dayofweek'
  ) THEN
    ALTER TABLE groups DROP COLUMN dayofweek;
    RAISE NOTICE 'Dropped dayofweek column';
  ELSE
    RAISE NOTICE 'dayofweek column already removed';
  END IF;
  
  -- Drop time column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'time'
  ) THEN
    ALTER TABLE groups DROP COLUMN time;
    RAISE NOTICE 'Dropped time column';
  ELSE
    RAISE NOTICE 'time column already removed';
  END IF;
  
  -- Drop local column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'local'
  ) THEN
    ALTER TABLE groups DROP COLUMN local;
    RAISE NOTICE 'Dropped local column';
  ELSE
    RAISE NOTICE 'local column already removed';
  END IF;
  
  RAISE NOTICE '======= MIGRATION COMPLETE =======';
END $$; 