/*
  # Fix Pages RLS Policies

  1. Changes
    - Drop existing restrictive policies
    - Create more permissive policies that work with the current auth setup
    - Allow authenticated admins to manage pages
    - Allow public to view published pages

  2. Security
    - Maintains security by checking user role
    - Uses proper auth.uid() checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view published pages" ON pages;
DROP POLICY IF EXISTS "Authenticated users can view all pages" ON pages;
DROP POLICY IF EXISTS "Admins can insert pages" ON pages;
DROP POLICY IF EXISTS "Admins can update pages" ON pages;
DROP POLICY IF EXISTS "Admins can delete pages" ON pages;

-- Create new policies with better checks
CREATE POLICY "Anyone can view published pages"
  ON pages FOR SELECT
  USING (status = 'published' OR auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert pages"
  ON pages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Authenticated users can update pages"
  ON pages FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'moderator')
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Authenticated users can delete pages"
  ON pages FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role IN ('admin', 'moderator')
    )
  );
