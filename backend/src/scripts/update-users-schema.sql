-- Update users table to support multiple agent selection
-- Add location_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INTEGER;

-- Add selected_agent_ids column (JSON array)
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_agent_ids JSONB DEFAULT '[]'::jsonb;

-- Create index for location_id
CREATE INDEX IF NOT EXISTS idx_users_location_id ON users(location_id);

-- Create index for selected_agent_ids
CREATE INDEX IF NOT EXISTS idx_users_selected_agent_ids ON users USING GIN (selected_agent_ids);

-- Update existing users to have default values
UPDATE users SET location_id = 1 WHERE location_id IS NULL;
UPDATE users SET selected_agent_ids = '[]'::jsonb WHERE selected_agent_ids IS NULL;

-- If there are existing selected_agent_id values, migrate them to selected_agent_ids
UPDATE users 
SET selected_agent_ids = jsonb_build_array(selected_agent_id)
WHERE selected_agent_id IS NOT NULL 
AND (selected_agent_ids IS NULL OR selected_agent_ids = '[]'::jsonb);

-- Update ads table to support multiple agent IDs
ALTER TABLE ads ADD COLUMN IF NOT EXISTS owner_selected_agent_ids JSONB DEFAULT '[]'::jsonb;

-- Create index for owner_selected_agent_ids
CREATE INDEX IF NOT EXISTS idx_ads_owner_selected_agent_ids ON ads USING GIN (owner_selected_agent_ids);

-- Migrate existing owner_selected_agent_id to owner_selected_agent_ids
UPDATE ads 
SET owner_selected_agent_ids = jsonb_build_array(owner_selected_agent_id)
WHERE owner_selected_agent_id IS NOT NULL 
AND (owner_selected_agent_ids IS NULL OR owner_selected_agent_ids = '[]'::jsonb);

-- Add foreign key constraint for location_id
ALTER TABLE users ADD CONSTRAINT fk_users_location_id 
FOREIGN KEY (location_id) REFERENCES locations(id);

-- Update existing users to have a valid location_id
UPDATE users SET location_id = 1 WHERE location_id IS NULL;

-- Add some sample data if locations table is empty
INSERT INTO locations (id, name) VALUES 
(1, 'Mumbai Central'),
(2, 'Delhi North'),
(3, 'Bangalore Tech'),
(4, 'Chennai South'),
(5, 'Kolkata East')
ON CONFLICT (id) DO NOTHING;
