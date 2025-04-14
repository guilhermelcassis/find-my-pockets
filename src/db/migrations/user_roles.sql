-- Enable the UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user_roles table to store user role assignments
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

-- Create an index on user_id for faster lookups (not necessary as a unique constraint already creates an index)
-- CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Create role_change_history table for audit purposes
CREATE TABLE IF NOT EXISTS role_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_role TEXT,
  new_role TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_change_history_user_id ON role_change_history(user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- IMPORTANT: First seed the initial admin user BEFORE enabling RLS
-- Seed the initial admin user (replace with the actual UUID of your admin user)
INSERT INTO user_roles (user_id, role, created_at, updated_at)
VALUES 
('8c953e2a-4782-40e0-8e54-83e71a0c4a3a', 'admin', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;

-- NOW enable Row Level Security (RLS) policies for user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Only allow admins to select from the user_roles table
CREATE POLICY select_user_roles ON user_roles
  FOR SELECT USING (
    -- Allow users to see their own role
    auth.uid() = user_id OR
    -- Allow admins to see all roles
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only allow admins to insert new roles
CREATE POLICY insert_user_roles ON user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only allow admins to update roles
CREATE POLICY update_user_roles ON user_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only allow admins to delete roles
CREATE POLICY delete_user_roles ON user_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Row Level Security (RLS) policies for role_change_history table
ALTER TABLE role_change_history ENABLE ROW LEVEL SECURITY;

-- Only allow admins to select from the role_change_history table
CREATE POLICY select_role_change_history ON role_change_history
  FOR SELECT USING (
    -- Allow users to see their own history
    auth.uid() = user_id OR
    -- Allow admins to see all history
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Only allow admins to insert into role_change_history
CREATE POLICY insert_role_change_history ON role_change_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  ); 