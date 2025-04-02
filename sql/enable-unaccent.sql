-- Enable the unaccent extension to support accent-insensitive searches
-- Run this script in the Supabase SQL Editor

-- Check if unaccent extension is already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'unaccent'
  ) THEN
    -- Create the unaccent extension
    CREATE EXTENSION unaccent;
    RAISE NOTICE 'Unaccent extension has been enabled successfully.';
  ELSE
    RAISE NOTICE 'Unaccent extension is already enabled.';
  END IF;
END
$$;

-- Test the unaccent functionality
SELECT unaccent('São Paulo') AS normalized;
-- Should return "sao paulo"

-- Note: After enabling this extension, searches will be accent-insensitive
-- For example, searching for "SAO PAULO" will match "São Paulo" 