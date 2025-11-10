-- Remove OTP-related columns from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS otp_hash;

-- Remove OTP logs table entirely (since we're removing OTP functionality)
DROP TABLE IF EXISTS otp_logs;

-- Update the orders table to remove OTP-related constraints if any
-- (The otp_hash column removal above should handle this)

-- Optional: If you want to clean up any OTP-related indexes
-- (PostgreSQL will automatically remove indexes when columns are dropped)

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND table_schema = 'public'
ORDER BY ordinal_position;
