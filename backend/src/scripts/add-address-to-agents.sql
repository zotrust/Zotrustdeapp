-- Add address field to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS address TEXT;

-- Update existing agents with sample addresses
UPDATE agents SET address = '123 MG Road, Mumbai' WHERE id = 1;
UPDATE agents SET address = '456 CP, New Delhi' WHERE id = 2;
UPDATE agents SET address = '789 IT Park, Bangalore' WHERE id = 3;
UPDATE agents SET address = '321 Marina Beach, Chennai' WHERE id = 4;
UPDATE agents SET address = '654 Park Street, Kolkata' WHERE id = 5;
