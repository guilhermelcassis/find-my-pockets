-- Migration to convert legacy meeting fields to meetingTimes array
-- Run this script in your Supabase SQL editor

-- Step 1: Add the meetingTimes column if it doesn't exist yet
ALTER TABLE groups ADD COLUMN IF NOT EXISTS "meetingTimes" JSONB DEFAULT '[]'::JSONB;

-- Step 2: Update all existing groups - convert legacy fields to meetingTimes array
-- Only update records where meetingTimes is empty and dayofweek/time have values
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

-- Step 3: Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM groups WHERE jsonb_array_length("meetingTimes") > 0;
  RAISE NOTICE 'Updated % group records with meetingTimes data', updated_count;
END $$;

-- Step 4: Explain the structure in a comment
COMMENT ON COLUMN groups."meetingTimes" IS 
'Array of meeting times, each with dayofweek, time, and optional local fields. 
 Legacy fields (dayofweek, time, local) are kept for backward compatibility.'; 