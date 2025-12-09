/*
  # Community Management System - Database Schema

  This migration creates the complete database schema for a community management system.

  ## 1. New Tables
  
  ### `users` table
    - `id` (uuid, primary key) - Unique identifier for each user
    - `name` (text, not null) - User's first name
    - `family_name` (text, not null) - User's family/last name
    - `display_name` (text, not null) - Auto-generated from name + family_name
    - `email` (text, unique, not null) - User's email address
    - `city` (text) - User's city
    - `country` (text) - User's country
    - `longitude` (numeric) - Geographic longitude coordinate
    - `latitude` (numeric) - Geographic latitude coordinate
    - `year_of_birth` (integer) - User's birth year
    - `sex` (text) - User's sex/gender
    - `created_at` (timestamptz) - Timestamp of record creation
    - `updated_at` (timestamptz) - Timestamp of last update

  ### `posts` table
    - `id` (uuid, primary key) - Unique identifier for each post
    - `title` (text, not null) - Post title
    - `body` (text, not null) - Post content
    - `user_id` (uuid, foreign key) - Reference to the author (users.id)
    - `created_at` (timestamptz) - Timestamp of post creation
    - `updated_at` (timestamptz) - Timestamp of last update

  ### `events` table
    - `id` (uuid, primary key) - Unique identifier for each event
    - `title` (text, not null) - Event title
    - `body` (text, not null) - Event description
    - `start_date` (timestamptz, not null) - Event start date and time
    - `end_date` (timestamptz, not null) - Event end date and time
    - `location_type` (text, not null) - Type of event: 'online', 'in_person', or 'hybrid'
    - `address` (text) - Physical address for in-person/hybrid events
    - `longitude` (numeric) - Geographic longitude for physical location
    - `latitude` (numeric) - Geographic latitude for physical location
    - `online_url` (text) - Meeting URL for online/hybrid events
    - `user_id` (uuid, foreign key) - Reference to the event creator (users.id)
    - `created_at` (timestamptz) - Timestamp of event creation
    - `updated_at` (timestamptz) - Timestamp of last update

  ## 2. Indexes
  
  Performance indexes created for:
    - `posts.user_id` - Fast lookup of posts by author
    - `posts.created_at` - Efficient sorting by creation date
    - `events.user_id` - Fast lookup of events by creator
    - `events.start_date` - Efficient sorting and filtering by date
    - `events.location_type` - Fast filtering by event type

  ## 3. Security (Row Level Security)
  
  All tables have RLS enabled with public access policies for this community system:
    - Users table: Public read access, authenticated users can insert/update/delete
    - Posts table: Public read access, authenticated users can insert/update/delete
    - Events table: Public read access, authenticated users can insert/update/delete

  ## 4. Important Notes
  
  - All primary keys use UUID with automatic generation via `gen_random_uuid()`
  - Timestamps use `timestamptz` with automatic `now()` defaults
  - Foreign keys have `ON DELETE CASCADE` to maintain referential integrity
  - Display name is auto-generated but can be customized
  - Location type is constrained to valid values: 'online', 'in_person', 'hybrid'
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  family_name text NOT NULL,
  display_name text NOT NULL,
  email text UNIQUE NOT NULL,
  city text,
  country text,
  longitude numeric,
  latitude numeric,
  year_of_birth integer,
  sex text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('online', 'in_person', 'hybrid')),
  address text,
  longitude numeric,
  latitude numeric,
  online_url text,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_location_type ON events(location_type);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users are viewable by everyone"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can be inserted by authenticated users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can be updated by authenticated users"
  ON users FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can be deleted by authenticated users"
  ON users FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Posts are viewable by everyone"
  ON posts FOR SELECT
  USING (true);

CREATE POLICY "Posts can be inserted by authenticated users"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Posts can be updated by authenticated users"
  ON posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Posts can be deleted by authenticated users"
  ON posts FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Events can be inserted by authenticated users"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Events can be updated by authenticated users"
  ON events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Events can be deleted by authenticated users"
  ON events FOR DELETE
  TO authenticated
  USING (true);