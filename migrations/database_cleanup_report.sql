-- Database Cleanup and Migration Report
-- This script doesn't make any changes, it just reports on the state of the database

-- Count all groups
DO $$
DECLARE
  total_groups INTEGER;
  active_groups INTEGER;
  inactive_groups INTEGER;
  groups_with_meeting_times INTEGER;
  groups_without_meeting_times INTEGER;
  groups_with_empty_name INTEGER;
  groups_with_null_tipo INTEGER;
BEGIN
  -- Count groups
  SELECT COUNT(*) INTO total_groups FROM groups;
  SELECT COUNT(*) INTO active_groups FROM groups WHERE active = TRUE;
  SELECT COUNT(*) INTO inactive_groups FROM groups WHERE active = FALSE OR active IS NULL;
  
  -- Count groups with/without meeting times
  SELECT COUNT(*) INTO groups_with_meeting_times 
  FROM groups WHERE "meetingTimes" IS NOT NULL AND jsonb_array_length("meetingTimes") > 0;
  
  SELECT COUNT(*) INTO groups_without_meeting_times 
  FROM groups WHERE "meetingTimes" IS NULL OR jsonb_array_length("meetingTimes") = 0;
  
  -- Count groups with empty name
  SELECT COUNT(*) INTO groups_with_empty_name
  FROM groups WHERE name IS NULL OR name = '';
  
  -- Count groups with null tipo
  SELECT COUNT(*) INTO groups_with_null_tipo
  FROM groups WHERE tipo IS NULL OR tipo = '';

  -- Display results
  RAISE NOTICE '======= DATABASE MIGRATION REPORT =======';
  RAISE NOTICE 'Total groups: %', total_groups;
  RAISE NOTICE 'Active groups: %', active_groups;
  RAISE NOTICE 'Inactive groups: %', inactive_groups;
  RAISE NOTICE 'Groups with meeting times: %', groups_with_meeting_times;
  RAISE NOTICE 'Groups without meeting times: %', groups_without_meeting_times;
  RAISE NOTICE 'Groups with empty name: %', groups_with_empty_name;
  RAISE NOTICE 'Groups with null tipo: %', groups_with_null_tipo;
  RAISE NOTICE '========================================';
  
  -- Warning for data that needs migration
  IF groups_without_meeting_times > 0 THEN
    RAISE WARNING 'There are % groups without meeting times data that need migration', groups_without_meeting_times;
  END IF;
  
  IF groups_with_null_tipo > 0 THEN
    RAISE WARNING 'There are % groups with NULL tipo field that need to be set', groups_with_null_tipo;
  END IF;
END $$; 