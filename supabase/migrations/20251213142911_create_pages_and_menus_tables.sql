/*
  # Create Pages and Menu Items Tables

  1. New Tables
    - `pages`
      - `id` (uuid, primary key) - Unique identifier for each page
      - `title` (text) - Page title
      - `slug` (text, unique) - URL-friendly page identifier
      - `parent_id` (uuid, nullable) - References parent page for hierarchical structure
      - `content` (jsonb) - Array of page blocks with component configurations
      - `status` (text) - Page status: draft, published
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `menu_items`
      - `id` (uuid, primary key) - Unique identifier for each menu item
      - `menu_name` (text) - Menu location identifier (header, footer, sidebar)
      - `label` (text) - Display text for menu item
      - `url` (text) - Link destination
      - `parent_id` (uuid, nullable) - References parent menu item for nested menus
      - `position` (integer) - Sort order within level
      - `icon` (text, nullable) - Optional icon identifier or emoji
      - `target` (text) - Link target (_self, _blank, etc)
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on both tables
    - Public read access for published pages
    - Authenticated users can read all pages
    - Only admins can create, update, delete pages
    - Public read access for menu items
    - Only admins can manage menu items

  3. Indexes
    - Index on pages.slug for fast lookups
    - Index on pages.parent_id for hierarchical queries
    - Index on menu_items.menu_name for fetching specific menus
    - Index on menu_items.parent_id for building menu trees
*/

-- Create pages table
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  parent_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  content jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_name text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  parent_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  icon text,
  target text DEFAULT '_self' CHECK (target IN ('_self', '_blank', '_parent', '_top')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_name ON menu_items(menu_name);
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_position ON menu_items(menu_name, position);

-- Enable Row Level Security
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Pages policies
CREATE POLICY "Public can view published pages"
  ON pages FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authenticated users can view all pages"
  ON pages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert pages"
  ON pages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update pages"
  ON pages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete pages"
  ON pages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Menu items policies
CREATE POLICY "Anyone can view menu items"
  ON menu_items FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Add trigger to update updated_at timestamp on pages
CREATE OR REPLACE FUNCTION update_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_updated_at_trigger
  BEFORE UPDATE ON pages
  FOR EACH ROW
  EXECUTE FUNCTION update_pages_updated_at();

-- Add trigger to update updated_at timestamp on menu_items
CREATE OR REPLACE FUNCTION update_menu_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_items_updated_at_trigger
  BEFORE UPDATE ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_menu_items_updated_at();
