-- Add missing columns to users table for profile updates
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_agent_ids JSONB;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('location_id', 'selected_agent_ids')
ORDER BY column_name;
