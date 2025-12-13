/*
  # Update User Signup to Capture Full Profile

  ## Changes
    - Update `handle_new_user()` function to extract all profile fields from auth metadata
    - Includes: city, country, latitude, longitude, year_of_birth, sex
    - All fields are now captured during signup instead of requiring profile completion later

  ## Fields Extracted from Metadata
    - name
    - family_name
    - city
    - country
    - latitude (stored as numeric)
    - longitude (stored as numeric)
    - year_of_birth (stored as integer)
    - sex

  ## Important Notes
    - Display name is auto-generated from name and family_name
    - Default role is 'user' for all new signups
    - All metadata fields are optional with sensible defaults
*/

-- Update function to handle new user signup with full profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (
    auth_user_id,
    email,
    name,
    family_name,
    display_name,
    city,
    country,
    latitude,
    longitude,
    year_of_birth,
    sex,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', 'User') || ' ' || COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'country',
    (NEW.raw_user_meta_data->>'latitude')::numeric,
    (NEW.raw_user_meta_data->>'longitude')::numeric,
    (NEW.raw_user_meta_data->>'year_of_birth')::integer,
    NEW.raw_user_meta_data->>'sex',
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
