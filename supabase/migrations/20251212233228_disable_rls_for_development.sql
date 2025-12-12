/*
  # Disable Row Level Security for Development

  This migration temporarily disables Row Level Security (RLS) on all tables
  to allow unrestricted access during development.

  ## Changes
  
  1. Drop all existing RLS policies on users, posts, and events tables
  2. Disable RLS on all three tables

  ## Security Note
  
  This configuration allows public access to all data without authentication.
  RLS should be re-enabled before deploying to production.
*/

DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users can be inserted by authenticated users" ON users;
DROP POLICY IF EXISTS "Users can be updated by authenticated users" ON users;
DROP POLICY IF EXISTS "Users can be deleted by authenticated users" ON users;

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Posts can be inserted by authenticated users" ON posts;
DROP POLICY IF EXISTS "Posts can be updated by authenticated users" ON posts;
DROP POLICY IF EXISTS "Posts can be deleted by authenticated users" ON posts;

DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Events can be inserted by authenticated users" ON events;
DROP POLICY IF EXISTS "Events can be updated by authenticated users" ON events;
DROP POLICY IF EXISTS "Events can be deleted by authenticated users" ON events;

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
