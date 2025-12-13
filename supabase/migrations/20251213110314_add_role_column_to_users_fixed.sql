/*
  # Add Role Column to Users Table

  ## Changes
    - Add `role` column to users table with default value 'user'
    - Add check constraint for valid role values
    - This fixes the database error during signup where the trigger was trying to insert into a non-existent role column

  ## Notes
    - Role values: 'user', 'moderator', 'admin'
    - Default is 'user' for all new signups
*/

-- Add role column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user';
    
    -- Add check constraint for valid role values
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('user', 'moderator', 'admin'));
  END IF;
END $$;
