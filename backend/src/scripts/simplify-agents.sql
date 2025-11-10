-- First create locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add location_id to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);

-- Remove unnecessary columns from agents table
ALTER TABLE agents DROP COLUMN IF EXISTS city;
ALTER TABLE agents DROP COLUMN IF EXISTS state;
ALTER TABLE agents DROP COLUMN IF EXISTS country;
ALTER TABLE agents DROP COLUMN IF EXISTS address;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_agents_location ON agents(location_id);

-- Insert sample locations
INSERT INTO locations (name) VALUES
('Mumbai Central'),
('Delhi North'),
('Bangalore Tech'),
('Chennai South'),
('Kolkata East')
ON CONFLICT (name) DO NOTHING;

-- Update existing agents to reference locations (assign to first location by default)
UPDATE agents SET location_id = 1 WHERE location_id IS NULL;

-- Insert sample agents with simplified structure
INSERT INTO agents (branch_name, mobile, location_id, verified, created_by_admin) VALUES
('Mumbai Central Branch', '+91-9876543210', 1, true, 1),
('Delhi North Branch', '+91-9876543211', 2, true, 1),
('Bangalore Tech Branch', '+91-9876543212', 3, true, 1),
('Chennai South Branch', '+91-9876543213', 4, false, 1),
('Kolkata East Branch', '+91-9876543214', 5, true, 1)
ON CONFLICT DO NOTHING;
