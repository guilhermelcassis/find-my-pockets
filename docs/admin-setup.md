# Admin User Setup & Management Guide

This guide explains how to manage admin users in the Dunamis Pockets application.

## Initial Admin Setup

When you first set up the application, you'll need to designate at least one admin user to access the admin panel and manage the application.

### Step 1: Create the Database Tables

Run the SQL migration script to create the necessary tables:

1. Navigate to the SQL Editor in your Supabase dashboard
2. Open the file `src/db/migrations/user_roles.sql` from your project
3. Before running the script, replace `'YOUR_ADMIN_USER_ID'` with the actual UUID of your admin user
4. Run the script

### Step 2: Find Your User ID

To find your User ID:

1. Log in to your application
2. In the Supabase dashboard, go to **Authentication** > **Users**
3. Find your user in the list and copy the UUID

### Step 3: Grant Admin Privileges

Either:

1. Update the SQL script with your UUID and run it, or
2. Run this SQL query directly:

```sql
INSERT INTO user_roles (user_id, role, created_at, updated_at)
VALUES 
('[YOUR-USER-UUID]', 'admin', NOW(), NOW())
ON CONFLICT (user_id) DO NOTHING;
```

## Managing Admin Users

### Using the Admin Interface

Once you have at least one admin user, you can manage other users through the admin interface:

1. Log in as an admin user
2. Navigate to `/admin/users`
3. Use the interface to:
   - View all users
   - Grant or revoke admin privileges
   - Invite new users

### Inviting New Admin Users

To invite a new admin:

1. Go to `/admin/users`
2. Use the "Invite User" form to send an invitation email
3. Once the user accepts the invitation and creates an account, you can grant them admin privileges

### Manually Managing Roles

If needed, you can manage admin roles directly in the database:

```sql
-- Grant admin role
INSERT INTO user_roles (user_id, role)
VALUES ('[USER-UUID]', 'admin')
ON CONFLICT (user_id) DO UPDATE
SET role = 'admin', updated_at = NOW();

-- Revoke admin role
UPDATE user_roles
SET role = 'user', updated_at = NOW()
WHERE user_id = '[USER-UUID]';

-- Delete role entirely
DELETE FROM user_roles
WHERE user_id = '[USER-UUID]';
```

## Administrative Security

Keep in mind:

- Admin privileges give users full access to your application's administrative functions
- Only grant admin access to trusted users
- Regularly audit the list of admin users
- The system maintains a history of role changes in the `role_change_history` table for audit purposes

## Troubleshooting

If you encounter issues with admin access:

1. Verify that the user has a record in the `user_roles` table with role = 'admin'
2. Check that the `verifyAdmin` function is working correctly
3. Ensure the user is properly authenticated
4. Check the Supabase logs for any authentication errors

For persistent issues, you may need to directly check the database tables:

```sql
-- Check if a user has admin role
SELECT * FROM user_roles WHERE user_id = '[USER-UUID]';

-- View all admin users
SELECT u.email, u.id, r.role
FROM auth.users u
JOIN user_roles r ON u.id = r.user_id
WHERE r.role = 'admin';
``` 