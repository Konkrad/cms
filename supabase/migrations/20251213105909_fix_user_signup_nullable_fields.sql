/*
  # Fix User Signup with Nullable Profile Fields

  ## Changes
    - Update `handle_new_user()` function to properly handle nullable/empty fields
    - Use NULLIF to convert empty strings to NULL before casting
    - Prevents database errors when casting empty strings to numeric/integer types

  ## Fixed Fields
    - latitude: Handle empty string and null values
    - longitude: Handle empty string and null values  
    - year_of_birth: Handle empty string and null values
    - All text fields: Allow null values gracefully
*/

-- Update function to handle new user signup with proper null handling
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
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->>'latitude' IS NULL OR NEW.raw_user_meta_data->>'latitude' = '' 
      THEN NULL 
      ELSE (NEW.raw_user_meta_data->>'latitude')::numeric 
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'longitude' IS NULL OR NEW.raw_user_meta_data->>'longitude' = '' 
      THEN NULL 
      ELSE (NEW.raw_user_meta_data->>'longitude')::numeric 
    END,
    CASE 
      WHEN NEW.raw_user_meta_data->>'year_of_birth' IS NULL OR NEW.raw_user_meta_data->>'year_of_birth' = '' 
      THEN NULL 
      ELSE (NEW.raw_user_meta_data->>'year_of_birth')::integer 
    END,
    NULLIF(NEW.raw_user_meta_data->>'sex', ''),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
