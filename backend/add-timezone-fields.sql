-- Add timezone and formatted date/time fields to orders table

-- Add timezone field (e.g., "Asia/Kolkata", "UTC", etc.)
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);

-- Add formatted start date and time as string (e.g., "2025-10-09 18:13:34 IST")
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS start_datetime_string VARCHAR(100);

-- Update existing orders with default values
UPDATE orders 
SET timezone = 'UTC',
    start_datetime_string = to_char(start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS "UTC"')
WHERE timezone IS NULL;

-- Add comments for clarity
COMMENT ON COLUMN orders.timezone IS 'User timezone when order was created (e.g., Asia/Kolkata)';
COMMENT ON COLUMN orders.start_datetime_string IS 'Formatted start date and time with timezone (e.g., 2025-10-09 18:13:34 IST)';

