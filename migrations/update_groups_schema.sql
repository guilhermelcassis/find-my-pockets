-- Migration to update groups table schema
-- Run this script in your Supabase SQL editor

-- First, make sure the meetingTimes array is populated for all groups
-- This ensures we don't lose any data when we deprecate dayofweek/time
DO $$
BEGIN
  -- Run the meetingTimes migration if not already done
  IF EXISTS (
    SELECT 1 FROM groups 
    WHERE (dayofweek IS NOT NULL AND dayofweek != '') 
    AND (time IS NOT NULL AND time != '')
    AND ("meetingTimes" IS NULL OR jsonb_array_length("meetingTimes") = 0)
  ) THEN
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
      
    RAISE NOTICE 'Populated meetingTimes array for existing groups';
  END IF;
END $$;

-- Step 1: Set default values for tipo where it's NULL
UPDATE groups 
SET tipo = 'Publica' 
WHERE tipo IS NULL OR tipo = '';

-- Step 2: Make tipo required (NOT NULL)
ALTER TABLE groups 
ALTER COLUMN tipo SET NOT NULL;

-- Step 3: Add deprecation comments to fields we want to phase out
COMMENT ON COLUMN groups.name IS 'DEPRECATED: This field is kept for backward compatibility';
COMMENT ON COLUMN groups.dayofweek IS 'DEPRECATED: Use meetingTimes array instead. This field is kept for backward compatibility';
COMMENT ON COLUMN groups.time IS 'DEPRECATED: Use meetingTimes array instead. This field is kept for backward compatibility';
COMMENT ON COLUMN groups.local IS 'DEPRECATED: Use meetingTimes array instead. This field is kept for backward compatibility';

-- Step 4: Add a comment on tipo column
COMMENT ON COLUMN groups.tipo IS 'Required field - Public or Private (Publica ou Privada)';

-- For reference, print the current schema
DO $$
DECLARE
  required_fields TEXT;
  deprecated_fields TEXT;
BEGIN
  SELECT string_agg(column_name, ', ') INTO required_fields
  FROM information_schema.columns
  WHERE table_name = 'groups' AND is_nullable = 'NO';
  
  SELECT string_agg(column_name, ', ') INTO deprecated_fields
  FROM information_schema.columns
  WHERE table_name = 'groups' AND col_description((table_schema || '.' || table_name)::regclass::oid, ordinal_position) LIKE 'DEPRECATED%';
  
  RAISE NOTICE 'Required fields: %', required_fields;
  RAISE NOTICE 'Deprecated fields: %', deprecated_fields;
END $$; 