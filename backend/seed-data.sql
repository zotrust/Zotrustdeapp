-- Add locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add location_id to agents table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agents' AND column_name='location_id'
    ) THEN
        ALTER TABLE agents ADD COLUMN location_id INTEGER REFERENCES locations(id);
    END IF;
END $$;

-- Insert locations
INSERT INTO locations (name, state, country) VALUES 
('Mumbai', 'Maharashtra', 'India'),
('Delhi', 'Delhi', 'India'),
('Bangalore', 'Karnataka', 'India'),
('Hyderabad', 'Telangana', 'India'),
('Ahmedabad', 'Gujarat', 'India'),
('Chennai', 'Tamil Nadu', 'India'),
('Kolkata', 'West Bengal', 'India'),
('Pune', 'Maharashtra', 'India'),
('Surat', 'Gujarat', 'India'),
('Daman', 'Daman and Diu', 'India')
ON CONFLICT (name) DO NOTHING;

-- Insert dummy users (with your wallet addresses)
INSERT INTO users (address, name, phone, city, verified) VALUES 
('0xf919f62c49796f3dd1fbc9aeef9001483c53bc0d', 'Bhavin Pathak', '9876543210', 'Mumbai', true),
('0x1dbcbb2774307e3535da493f34039cfa7dbfd8f9', 'Seller User', '9876543211', 'Delhi', true),
('0x3bd2728d4dbaa276e1f1f9e7bf7abb0f598bb495', 'Buyer User', '9876543212', 'Bangalore', true)
ON CONFLICT (address) DO UPDATE SET 
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    verified = EXCLUDED.verified;

-- Insert dummy agents
INSERT INTO agents (branch_name, city, address, mobile, verified, location_id) VALUES 
('Main Branch Mumbai', 'Mumbai', 'Nariman Point, Mumbai', '9123456780', true, (SELECT id FROM locations WHERE name = 'Mumbai')),
('Central Delhi Office', 'Delhi', 'Connaught Place, Delhi', '9123456781', true, (SELECT id FROM locations WHERE name = 'Delhi')),
('Bangalore Hub', 'Bangalore', 'MG Road, Bangalore', '9123456782', true, (SELECT id FROM locations WHERE name = 'Bangalore')),
('Prabhudev Daman', 'Daman', 'Near Beach, Daman', '8347232980', true, (SELECT id FROM locations WHERE name = 'Daman')),
('Hyderabad Center', 'Hyderabad', 'Banjara Hills, Hyderabad', '9123456783', true, (SELECT id FROM locations WHERE name = 'Hyderabad'))
ON CONFLICT DO NOTHING;

-- Update existing users to link with agents
UPDATE users SET selected_agent_id = (SELECT id FROM agents WHERE branch_name = 'Prabhudev Daman' LIMIT 1)
WHERE address = '0xf919f62c49796f3dd1fbc9aeef9001483c53bc0d';

-- Insert dummy ads
INSERT INTO ads (owner_address, type, token, price_inr, min_amount, max_amount, city, active, owner_selected_agent_id) VALUES 
(
    '0xf919f62c49796f3dd1fbc9aeef9001483c53bc0d', 
    'BUY', 
    'USDT', 
    86.00, 
    200, 
    50000, 
    'Mumbai', 
    true,
    (SELECT id FROM agents WHERE branch_name = 'Prabhudev Daman' LIMIT 1)
),
(
    '0x1dbcbb2774307e3535da493f34039cfa7dbfd8f9', 
    'SELL', 
    'USDT', 
    85.50, 
    100, 
    25000, 
    'Delhi', 
    true,
    (SELECT id FROM agents WHERE branch_name = 'Central Delhi Office' LIMIT 1)
),
(
    '0x3bd2728d4dbaa276e1f1f9e7bf7abb0f598bb495', 
    'BUY', 
    'USDC', 
    86.20, 
    500, 
    100000, 
    'Bangalore', 
    true,
    (SELECT id FROM agents WHERE branch_name = 'Bangalore Hub' LIMIT 1)
)
ON CONFLICT DO NOTHING;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Seed data inserted successfully!';
    RAISE NOTICE '📊 Users: %, Agents: %, Locations: %, Ads: %', 
        (SELECT COUNT(*) FROM users),
        (SELECT COUNT(*) FROM agents),
        (SELECT COUNT(*) FROM locations),
        (SELECT COUNT(*) FROM ads);
END $$;

