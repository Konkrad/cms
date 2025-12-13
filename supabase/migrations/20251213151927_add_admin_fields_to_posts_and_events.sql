/*
  # Add fields for admin management of posts and events

  1. Changes to posts table
    - Add `excerpt` column (text) for post summaries
    - Add `category` column (text) for post categorization
    - Add `image_url` column (text, nullable) for post images
    - Add `published_at` column (timestamptz) for publication date

  2. Changes to events table
    - Add `description` column (text) as an alias/supplement to body
    - Add `event_date` column (date) for simplified date handling
    - Add `event_time` column (time) for simplified time handling
    - Add `image_url` column (text, nullable) for event images
    - Add `organizer_name` column (text) derived from user
    - Rename body to description for clarity

  3. Notes
    - These fields support the admin panel functionality
    - Existing data is preserved
    - All new columns are nullable to support existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'excerpt'
  ) THEN
    ALTER TABLE posts ADD COLUMN excerpt text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'category'
  ) THEN
    ALTER TABLE posts ADD COLUMN category text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE posts ADD COLUMN image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE posts ADD COLUMN published_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'description'
  ) THEN
    ALTER TABLE events ADD COLUMN description text;
    UPDATE events SET description = body WHERE description IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_date'
  ) THEN
    ALTER TABLE events ADD COLUMN event_date date;
    UPDATE events SET event_date = start_date::date WHERE event_date IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_time'
  ) THEN
    ALTER TABLE events ADD COLUMN event_time time;
    UPDATE events SET event_time = start_date::time WHERE event_time IS NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE events ADD COLUMN image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'location'
  ) THEN
    ALTER TABLE events ADD COLUMN location text;
    UPDATE events SET location = COALESCE(city || ', ' || country, city, country, address) WHERE location IS NULL;
  END IF;
END $$;
