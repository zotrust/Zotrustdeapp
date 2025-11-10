-- Update agents table to add location fields
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS state VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Update the agents table structure
-- Add indexes for better performance (only after columns exist)
CREATE INDEX IF NOT EXISTS idx_agents_city ON agents(city);
CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(verified);

-- Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    details TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user if not exists
INSERT INTO admin_users (username, password_hash, role) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Add indexes for new location columns (after they're created)
CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state);
CREATE INDEX IF NOT EXISTS idx_agents_country ON agents(country);

-- Insert some sample agents with location data
INSERT INTO agents (branch_name, city, state, country, address, mobile, verified, created_by_admin) VALUES
('Mumbai Central Branch', 'Mumbai', 'Maharashtra', 'India', '123 MG Road, Mumbai', '+91-9876543210', true, 1),
('Delhi North Branch', 'Delhi', 'Delhi', 'India', '456 CP, New Delhi', '+91-9876543211', true, 1),
('Bangalore Tech Branch', 'Bangalore', 'Karnataka', 'India', '789 IT Park, Bangalore', '+91-9876543212', true, 1),
('Chennai South Branch', 'Chennai', 'Tamil Nadu', 'India', '321 Marina Beach, Chennai', '+91-9876543213', false, 1),
('Kolkata East Branch', 'Kolkata', 'West Bengal', 'India', '654 Park Street, Kolkata', '+91-9876543214', true, 1)
ON CONFLICT DO NOTHING;
