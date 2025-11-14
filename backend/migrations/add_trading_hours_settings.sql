-- Add trading hours settings to app_settings table
INSERT INTO app_settings (key, value, description) VALUES
    ('trading_buy_enabled', 'true', 'Enable/disable BUY trading (true/false)'),
    ('trading_sell_enabled', 'true', 'Enable/disable SELL trading (true/false)'),
    ('trading_start_time', '09:00', 'Trading start time in HH:MM format (24-hour, IST)'),
    ('trading_end_time', '18:00', 'Trading end time in HH:MM format (24-hour, IST)')
ON CONFLICT (key) DO NOTHING;

