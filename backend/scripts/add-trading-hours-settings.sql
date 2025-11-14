-- Active: 1761026031156@@185.112.144.66@5432
-- =============================================
-- TRADING HOURS SETTINGS
-- =============================================
-- This script adds trading hours configuration settings
-- to the app_settings table
-- =============================================

-- First, check if description column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'app_settings' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to app_settings table';
    END IF;
END $$;

-- Add trading hours settings to app_settings table
INSERT INTO app_settings (key, value, description) VALUES
    ('trading_buy_enabled', 'true', 'Enable/disable BUY trading (true/false)'),
    ('trading_sell_enabled', 'true', 'Enable/disable SELL trading (true/false)'),
    ('trading_start_time', '09:00', 'Trading start time in HH:MM format (24-hour, IST)'),
    ('trading_end_time', '18:00', 'Trading end time in HH:MM format (24-hour, IST)')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, app_settings.description),
    updated_at = NOW();

-- Verify the settings were added
SELECT 
    key,
    value,
    COALESCE(description, 'No description') as description,
    updated_at
FROM app_settings
WHERE key IN ('trading_buy_enabled', 'trading_sell_enabled', 'trading_start_time', 'trading_end_time')
ORDER BY key;

-- =============================================
-- END OF SCRIPT
-- =============================================

