-- Migration to fix duplicate leaders and add unique constraints
-- Run this script in your Supabase SQL editor

-- Step 1: Identify and remove duplicate leaders
-- First, create a temporary table with unique leaders (keeping the first created one)
CREATE TEMP TABLE unique_leaders AS
SELECT DISTINCT ON (LOWER(email)) id, name, phone, email, curso, created_at, active
FROM leaders
WHERE email IS NOT NULL AND TRIM(email) != ''
ORDER BY LOWER(email), created_at;

-- Also keep leaders with no email or empty email
INSERT INTO unique_leaders
SELECT id, name, phone, email, curso, created_at, active
FROM leaders
WHERE email IS NULL OR TRIM(email) = '';

-- Step 2: Delete all leaders and reinsert the unique ones
DELETE FROM leaders;

INSERT INTO leaders (id, name, phone, email, curso, created_at, active)
SELECT id, name, phone, email, curso, created_at, active
FROM unique_leaders;

-- Step 3: Add a unique constraint on email for leaders (case insensitive)
-- First add an index to improve performance
CREATE UNIQUE INDEX IF NOT EXISTS leaders_email_unique_idx ON leaders (LOWER(email))
WHERE email IS NOT NULL AND TRIM(email) != '';

-- Step 4: Add a unique constraint on university + leader combination in groups
-- This requires modifying how the leader is stored in the groups table

-- First create a temporary column to store leader ID
ALTER TABLE groups ADD COLUMN leader_id uuid;

-- Update the leader_id column based on leader email and phone
UPDATE groups
SET leader_id = l.id
FROM leaders l
WHERE 
  l.name = groups.leader->>'name' AND 
  l.phone = groups.leader->>'phone';

-- Create a unique index on university + leader_id
CREATE UNIQUE INDEX IF NOT EXISTS groups_university_leader_unique_idx 
ON groups (university, leader_id)
WHERE active = true;

-- Add a comment explaining the constraint
COMMENT ON INDEX groups_university_leader_unique_idx IS 
'Ensures that each university has only one active group per leader';

-- Update any NULL leader_id values (data cleanup)
-- This is needed for any groups where the leader was not found
UPDATE groups 
SET leader_id = gen_random_uuid()
WHERE leader_id IS NULL;

-- Add a comment on the leader_id column
COMMENT ON COLUMN groups.leader_id IS 
'Reference to the leader ID, used for the unique constraint on university + leader';

-- Finally, update any duplicate university + leader combinations
-- by deactivating the older entries
UPDATE groups
SET active = false
WHERE id IN (
  SELECT g2.id
  FROM groups g1
  JOIN groups g2 ON g1.university = g2.university AND g1.leader_id = g2.leader_id
  WHERE g1.active = true AND g2.active = true AND g1.id != g2.id AND g1.updated_at > g2.updated_at
); 