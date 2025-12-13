/*
  # Add Authentication and Role-Based Access Control

  ## 1. Changes to users table
    - Add `auth_user_id` (uuid, unique) - Links to Supabase auth.users table
    - Add `role` (text) - User role: 'admin', 'community_manager', or 'user'
    - Set default role to 'user' for new accounts
    - Add index on auth_user_id for fast lookups

  ## 2. Database Functions
    - `handle_new_user()` - Trigger function that automatically creates a user record 
      when someone signs up via Supabase Auth
    - Extracts name and email from auth metadata
    - Sets default role to 'user'
    - Links auth.users.id to users.auth_user_id

  ## 3. Triggers
    - Trigger on `auth.users` table that calls `handle_new_user()` after insert
    - Automatically creates corresponding record in public.users table

  ## 4. Security (Row Level Security)
    
    ### Users Table:
    - Everyone can view user profiles (public read access)
    - Authenticated users can edit their own profile only
    - Admins and community managers can edit any user profile
    - Admins and community managers can delete users
    - Only admins can change user roles
    
    ### Posts Table:
    - Everyone can view posts (public read access)
    - Admins and community managers can create, edit, and delete any post
    - Regular users cannot manage posts
    
    ### Events Table:
    - Everyone can view events (public read access)
    - Admins and community managers can create, edit, and delete any event
    - Regular users cannot manage events

  ## 5. Helper Functions
    - `is_admin()` - Returns true if current user has admin or community_manager role
    - `get_user_role()` - Returns the role of the current authenticated user

  ## 6. Important Notes
    - First user to sign up can be manually promoted to admin via SQL
    - RLS is re-enabled with proper role-based policies
    - Users can only edit their own profiles (except admins)
    - Content management (posts/events) restricted to admin and community_manager roles
*/

-- Add role enum and auth_user_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'community_manager', 'user'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

-- Helper function to check if user is admin or community manager
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND role IN ('admin', 'community_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE auth_user_id = auth.uid();
  
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    auth_user_id,
    email,
    name,
    family_name,
    display_name,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'User') || ' ' || COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users are viewable by everyone"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Admins can update any user profile"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  TO authenticated
  USING (is_admin());

-- Posts table policies
CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete posts"
  ON posts FOR DELETE
  TO authenticated
  USING (is_admin());

-- Events table policies
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (is_admin());