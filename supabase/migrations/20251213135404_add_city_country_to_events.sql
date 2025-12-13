/*
  # Add city and country columns to events table

  1. Changes
    - Add `city` column (text, nullable) to events table for storing city name
    - Add `country` column (text, nullable) to events table for storing country name
    
  2. Notes
    - These columns complement the existing address field for better location filtering
    - Nullable to support online-only events
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'city'
  ) THEN
    ALTER TABLE events ADD COLUMN city text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'country'
  ) THEN
    ALTER TABLE events ADD COLUMN country text;
  END IF;
END $$;
