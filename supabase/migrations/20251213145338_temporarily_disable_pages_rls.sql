/*
  # Temporarily Disable RLS for Pages and Menu Items

  This migration temporarily disables RLS on pages and menu_items tables
  for development purposes. This allows testing the page builder functionality
  while we work on the authentication integration.

  WARNING: This should be re-enabled before production deployment!

  1. Changes
    - Disable RLS on pages table
    - Disable RLS on menu_items table

  2. Security Notes
    - This is a temporary measure for development
    - RLS should be re-enabled with proper policies before production
*/

ALTER TABLE pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
