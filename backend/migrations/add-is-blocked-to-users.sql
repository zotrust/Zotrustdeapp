-- Add is_blocked column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked);

-- Add comments
COMMENT ON COLUMN users.is_blocked IS 'Whether user is blocked from using the platform';
COMMENT ON COLUMN users.blocked_at IS 'Timestamp when user was blocked';
COMMENT ON COLUMN users.blocked_reason IS 'Reason for blocking the user';

