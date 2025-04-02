-- Add new columns to the groups table
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS local TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS fulladdress TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS zipCode TEXT DEFAULT '';

-- Update the RLS policies if needed
-- First, drop any existing policies that might conflict
DROP POLICY IF EXISTS "Allow authenticated users to create groups" ON public.groups;
DROP POLICY IF EXISTS "Allow authenticated users to update groups" ON public.groups;

-- Create the policies with the correct syntax
CREATE POLICY "Allow authenticated users to create groups" 
  ON public.groups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update groups" 
  ON public.groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Note: Execute this script in the Supabase SQL Editor console 