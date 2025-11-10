-- Add start_time column to orders table
-- This will store the UTC time when order acceptance window starts

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;

-- Update existing orders to use created_at as start_time
UPDATE orders 
SET start_time = created_at 
WHERE start_time IS NULL;

-- Make it NOT NULL after updating existing data
ALTER TABLE orders 
ALTER COLUMN start_time SET NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN orders.start_time IS 'UTC time when order acceptance window starts (used for expiry calculation)';

