-- Fix users table schema to support multiple agents and locations

-- Create locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add location_id to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='location_id') THEN
        ALTER TABLE users ADD COLUMN location_id INTEGER REFERENCES locations(id);
    END IF;
END $$;

-- Add selected_agent_ids array column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='selected_agent_ids') THEN
        ALTER TABLE users ADD COLUMN selected_agent_ids INTEGER[];
    END IF;
END $$;

-- Migrate data from old selected_agent_id to new selected_agent_ids array
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='users' AND column_name='selected_agent_id') THEN
        -- Migrate single agent_id to array format
        UPDATE users 
        SET selected_agent_ids = ARRAY[selected_agent_id::INTEGER]
        WHERE selected_agent_id IS NOT NULL 
        AND (selected_agent_ids IS NULL OR selected_agent_ids = '{}');
    END IF;
END $$;

-- Add location_id to agents table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='agents' AND column_name='location_id') THEN
        ALTER TABLE agents ADD COLUMN location_id INTEGER REFERENCES locations(id);
    END IF;
END $$;

-- Create index for location_id in users table
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id);

-- Create index for location_id in agents table
CREATE INDEX IF NOT EXISTS idx_agents_location ON agents(location_id);

-- Create index for selected_agent_ids array in users table
CREATE INDEX IF NOT EXISTS idx_users_selected_agents ON users USING GIN(selected_agent_ids);

-- Insert some default locations if the table is empty
INSERT INTO locations (name, state, country, active) VALUES
('Mumbai', 'Maharashtra', 'India', true),
('Delhi', 'Delhi', 'India', true),
('Bangalore', 'Karnataka', 'India', true),
('Hyderabad', 'Telangana', 'India', true),
('Pune', 'Maharashtra', 'India', true),
('Kolkata', 'West Bengal', 'India', true),
('Chennai', 'Tamil Nadu', 'India', true),
('Ahmedabad', 'Gujarat', 'India', true)
ON CONFLICT DO NOTHING;

-- Update schema.sql comments
COMMENT ON COLUMN users.selected_agent_ids IS 'Array of agent IDs selected by the user';
COMMENT ON COLUMN users.location_id IS 'Reference to locations table';
COMMENT ON COLUMN agents.location_id IS 'Reference to locations table';

