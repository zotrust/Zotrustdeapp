-- Add location columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state);
CREATE INDEX IF NOT EXISTS idx_agents_country ON agents(country);

-- Insert sample data
INSERT INTO agents (branch_name, city, state, country, address, mobile, verified, created_by_admin) VALUES
('Mumbai Central Branch', 'Mumbai', 'Maharashtra', 'India', '123 MG Road, Mumbai', '+91-9876543210', true, 1),
('Delhi North Branch', 'Delhi', 'Delhi', 'India', '456 CP, New Delhi', '+91-9876543211', true, 1),
('Bangalore Tech Branch', 'Bangalore', 'Karnataka', 'India', '789 IT Park, Bangalore', '+91-9876543212', true, 1),
('Chennai South Branch', 'Chennai', 'Tamil Nadu', 'India', '321 Marina Beach, Chennai', '+91-9876543213', false, 1),
('Kolkata East Branch', 'Kolkata', 'West Bengal', 'India', '654 Park Street, Kolkata', '+91-9876543214', true, 1)
ON CONFLICT DO NOTHING;
