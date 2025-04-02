-- Migration to add 'active' column to groups and leaders tables
-- Run this script in your Supabase SQL editor

-- Add 'active' column to groups table with a default value of true
ALTER TABLE IF EXISTS "public"."groups" 
ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true;

-- Add 'active' column to leaders table with a default value of true
ALTER TABLE IF EXISTS "public"."leaders" 
ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true;

-- Comment on columns
COMMENT ON COLUMN "public"."groups"."active" IS 'Flag to indicate if the group is active or deactivated';
COMMENT ON COLUMN "public"."leaders"."active" IS 'Flag to indicate if the leader is active or deactivated';

-- Update existing rows to have active = true
UPDATE "public"."groups" SET "active" = true WHERE "active" IS NULL;
UPDATE "public"."leaders" SET "active" = true WHERE "active" IS NULL; 