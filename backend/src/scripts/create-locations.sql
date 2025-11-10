-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    address TEXT,
    postal_code VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add location_id to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
CREATE INDEX IF NOT EXISTS idx_locations_state ON locations(state);
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);
CREATE INDEX IF NOT EXISTS idx_agents_location ON agents(location_id);

-- Insert sample locations
INSERT INTO locations (name, city, state, country, address, postal_code) VALUES
('Mumbai Central', 'Mumbai', 'Maharashtra', 'India', '123 MG Road, Mumbai', '400001'),
('Delhi North', 'Delhi', 'Delhi', 'India', '456 CP, New Delhi', '110001'),
('Bangalore Tech', 'Bangalore', 'Karnataka', 'India', '789 IT Park, Bangalore', '560001'),
('Chennai South', 'Chennai', 'Tamil Nadu', 'India', '321 Marina Beach, Chennai', '600001'),
('Kolkata East', 'Kolkata', 'West Bengal', 'India', '654 Park Street, Kolkata', '700001')
ON CONFLICT DO NOTHING;

-- Update existing agents to reference locations
UPDATE agents SET location_id = 1 WHERE city = 'Mumbai';
UPDATE agents SET location_id = 2 WHERE city = 'Delhi';
UPDATE agents SET location_id = 3 WHERE city = 'Bangalore';
UPDATE agents SET location_id = 4 WHERE city = 'Chennai';
UPDATE agents SET location_id = 5 WHERE city = 'Kolkata';
