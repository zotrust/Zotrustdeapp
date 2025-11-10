-- =============================================
-- ZOTRUST P2P TRADING PLATFORM
-- Complete Database Schema
-- =============================================
-- Version: 2.0
-- Last Updated: 2025-10-10
-- Description: Complete schema with all tables, relationships, and indexes
-- =============================================

-- Drop tables in correct order (if recreating)
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS ads CASCADE;
-- DROP TABLE IF EXISTS calls CASCADE;
-- DROP TABLE IF EXISTS support CASCADE;
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS otp_logs CASCADE;
-- DROP TABLE IF EXISTS agents CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS admin_users CASCADE;
-- DROP TABLE IF EXISTS app_settings CASCADE;
-- DROP TABLE IF EXISTS locations CASCADE;

-- =============================================
-- 1. LOCATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    country VARCHAR(255) DEFAULT 'India',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE locations IS 'Master table for cities and locations';
COMMENT ON COLUMN locations.name IS 'Unique location name (e.g., Mumbai)';
COMMENT ON COLUMN locations.city IS 'City name';
COMMENT ON COLUMN locations.state IS 'State name';

-- =============================================
-- 2. USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL UNIQUE,
    name VARCHAR(255),
    phone VARCHAR(20),
    city VARCHAR(255),
    selected_agent_id BIGINT,
    selected_agent_ids TEXT[],
    location_id INTEGER REFERENCES locations(id),
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'User accounts for P2P trading';
COMMENT ON COLUMN users.address IS 'Ethereum wallet address (unique identifier)';
COMMENT ON COLUMN users.selected_agent_id IS 'Single selected agent (legacy, deprecated)';
COMMENT ON COLUMN users.selected_agent_ids IS 'Array of selected agent IDs (TEXT[] - supports multiple agents)';
COMMENT ON COLUMN users.location_id IS 'User preferred trading location';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(verified);

-- =============================================
-- 3. AGENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    branch_name VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    verified BOOLEAN DEFAULT FALSE,
    created_by_admin VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE agents IS 'Agent branches for cash exchange';
COMMENT ON COLUMN agents.branch_name IS 'Branch/agency name';
COMMENT ON COLUMN agents.location_id IS 'Reference to location';
COMMENT ON COLUMN agents.verified IS 'Admin verified agent';
COMMENT ON COLUMN agents.created_by_admin IS 'Admin wallet address who created this';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_city ON agents(city);
CREATE INDEX IF NOT EXISTS idx_agents_location ON agents(location_id);
CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(verified);

-- =============================================
-- 4. ADS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS ads (
    id SERIAL PRIMARY KEY,
    owner_address VARCHAR(42) NOT NULL,
    owner_selected_agent_id BIGINT,
    type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    token VARCHAR(10) NOT NULL CHECK (token IN ('TBNB', 'WBNB', 'USDT', 'USDC')),
    price_inr DECIMAL(18, 2) NOT NULL,
    min_amount DECIMAL(18, 6) NOT NULL,
    max_amount DECIMAL(18, 6) NOT NULL,
    sell_quantity DECIMAL(18, 6),
    buy_quantity DECIMAL(18, 6),
    lock_duration_seconds INTEGER DEFAULT 3600,
    city VARCHAR(255),
    location_id INTEGER REFERENCES locations(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ads IS 'P2P trading advertisements';
COMMENT ON COLUMN ads.type IS 'BUY or SELL advertisement';
COMMENT ON COLUMN ads.token IS 'Cryptocurrency token type';
COMMENT ON COLUMN ads.price_inr IS 'Price per token in INR';
COMMENT ON COLUMN ads.lock_duration_seconds IS 'How long buyer has to pay';
COMMENT ON COLUMN ads.location_id IS 'Preferred location for this ad';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ads_owner ON ads(owner_address);
CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(active);
CREATE INDEX IF NOT EXISTS idx_ads_type ON ads(type);
CREATE INDEX IF NOT EXISTS idx_ads_token ON ads(token);
CREATE INDEX IF NOT EXISTS idx_ads_city ON ads(city);
CREATE INDEX IF NOT EXISTS idx_ads_location ON ads(location_id);

-- =============================================
-- 5. ORDERS TABLE (WITH COUNTDOWN FEATURE)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    ad_id INTEGER NOT NULL REFERENCES ads(id),
    buyer_address VARCHAR(42) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    token VARCHAR(10) NOT NULL,
    state VARCHAR(20) DEFAULT 'CREATED' CHECK (
        state IN ('CREATED', 'ACCEPTED', 'LOCKED', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'REFUNDED')
    ),
    agent_branch VARCHAR(255),
    agent_number VARCHAR(20),
    agent_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timezone VARCHAR(255),
    start_datetime_string VARCHAR(255),
    accepted_at TIMESTAMP,
    lock_expires_at TIMESTAMP,
    otp_hash VARCHAR(255),
    tx_hash VARCHAR(66)
);

COMMENT ON TABLE orders IS 'Trading orders with 5-minute countdown';
COMMENT ON COLUMN orders.start_time IS 'UTC timestamp when order was created (for countdown)';
COMMENT ON COLUMN orders.timezone IS 'User timezone (e.g., Asia/Calcutta)';
COMMENT ON COLUMN orders.start_datetime_string IS 'Formatted display time with timezone';
COMMENT ON COLUMN orders.state IS 'Order workflow state';
COMMENT ON COLUMN orders.lock_expires_at IS 'When payment window expires';
COMMENT ON COLUMN orders.otp_hash IS 'Hashed OTP for payment confirmation';
COMMENT ON COLUMN orders.tx_hash IS 'Blockchain transaction hash';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_ad ON orders(ad_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_address);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_address);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);
CREATE INDEX IF NOT EXISTS idx_orders_start_time ON orders(start_time);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- =============================================
-- 6. OTP LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS otp_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    user_address VARCHAR(42),
    otp_hash VARCHAR(66) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE otp_logs IS 'OTP records for order verification';
COMMENT ON COLUMN otp_logs.order_id IS 'Order this OTP is for';
COMMENT ON COLUMN otp_logs.otp_hash IS 'SHA-256 hash of OTP (never store plain text)';
COMMENT ON COLUMN otp_logs.expires_at IS 'When this OTP expires';
COMMENT ON COLUMN otp_logs.used IS 'Whether OTP has been used';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_otp_logs_order ON otp_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_logs(user_address);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_logs(expires_at);

-- =============================================
-- 7. TRANSACTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    token VARCHAR(10) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    block_number BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

COMMENT ON TABLE transactions IS 'Blockchain transaction records';
COMMENT ON COLUMN transactions.type IS 'LOCK, RELEASE, REFUND, etc.';
COMMENT ON COLUMN transactions.status IS 'PENDING, CONFIRMED, FAILED';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions(to_address);

-- =============================================
-- 8. CALLS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    caller_address VARCHAR(42) NOT NULL,
    callee_address VARCHAR(42) NOT NULL,
    status VARCHAR(20),
    duration_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

COMMENT ON TABLE calls IS 'WebRTC call records';
COMMENT ON COLUMN calls.status IS 'INITIATED, CONNECTED, ENDED, FAILED';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_address);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_address);

-- =============================================
-- 9. AUDIT LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit_logs IS 'Activity audit trail';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., CREATE_ORDER, CANCEL_ORDER)';
COMMENT ON COLUMN audit_logs.details IS 'Additional context in JSON format';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_address);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_details ON audit_logs USING gin(details);

-- =============================================
-- 10. SUPPORT TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS support (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE support IS 'Customer support tickets';
COMMENT ON COLUMN support.status IS 'OPEN, IN_PROGRESS, RESOLVED, CLOSED';
COMMENT ON COLUMN support.priority IS 'LOW, MEDIUM, HIGH, URGENT';

-- Index
CREATE INDEX IF NOT EXISTS idx_support_user ON support(user_address);
CREATE INDEX IF NOT EXISTS idx_support_status ON support(status);

-- =============================================
-- 11. ADMIN USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'ADMIN',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE admin_users IS 'Admin panel users';
COMMENT ON COLUMN admin_users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN admin_users.role IS 'SUPER_ADMIN, ADMIN, SUPPORT, etc.';

-- =============================================
-- 12. APP SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE app_settings IS 'Application configuration settings';
COMMENT ON COLUMN app_settings.key IS 'Unique setting key';
COMMENT ON COLUMN app_settings.value IS 'Setting value (can be JSON)';

-- =============================================
-- INSERT DEFAULT DATA
-- =============================================

-- Default Locations (10 Major Indian Cities)
INSERT INTO locations (name, city, state) VALUES 
    ('Mumbai', 'Mumbai', 'Maharashtra'),
    ('Delhi', 'Delhi', 'Delhi'),
    ('Bangalore', 'Bangalore', 'Karnataka'),
    ('Hyderabad', 'Hyderabad', 'Telangana'),
    ('Ahmedabad', 'Ahmedabad', 'Gujarat'),
    ('Chennai', 'Chennai', 'Tamil Nadu'),
    ('Kolkata', 'Kolkata', 'West Bengal'),
    ('Pune', 'Pune', 'Maharashtra'),
    ('Jaipur', 'Jaipur', 'Rajasthan'),
    ('Surat', 'Surat', 'Gujarat')
ON CONFLICT (name) DO NOTHING;

-- Default App Settings
INSERT INTO app_settings (key, value, description) VALUES
    ('ORDER_ACCEPT_TIMEOUT_MINUTES', '5', 'Minutes before order expires if not accepted'),
    ('LOCK_PAYMENT_TIMEOUT_MINUTES', '60', 'Minutes to complete payment after accepting order'),
    ('PLATFORM_FEE_PERCENTAGE', '0.5', 'Platform fee percentage'),
    ('MIN_ORDER_AMOUNT_TBNB', '0.01', 'Minimum order amount in TBNB'),
    ('MIN_ORDER_AMOUNT_USDT', '10', 'Minimum order amount in USDT'),
    ('WEBSOCKET_HEARTBEAT_INTERVAL_MS', '30000', 'WebSocket heartbeat interval'),
    ('ENABLE_MAINTENANCE_MODE', 'false', 'Enable/disable maintenance mode')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =============================================
-- CREATE UPDATE TIMESTAMP TRIGGER
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_updated_at ON support;
CREATE TRIGGER update_support_updated_at 
    BEFORE UPDATE ON support 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SEQUENCES ALIGNMENT (Prevent ID Conflicts)
-- =============================================

-- Align all sequences with current max IDs
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('agents_id_seq', COALESCE((SELECT MAX(id) FROM agents), 1));
SELECT setval('ads_id_seq', COALESCE((SELECT MAX(id) FROM ads), 1));
SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1));
SELECT setval('otp_logs_id_seq', COALESCE((SELECT MAX(id) FROM otp_logs), 1));
SELECT setval('admin_users_id_seq', COALESCE((SELECT MAX(id) FROM admin_users), 1));
SELECT setval('calls_id_seq', COALESCE((SELECT MAX(id) FROM calls), 1));
SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 1));
SELECT setval('app_settings_id_seq', COALESCE((SELECT MAX(id) FROM app_settings), 1));
SELECT setval('locations_id_seq', COALESCE((SELECT MAX(id) FROM locations), 1));
SELECT setval('transactions_id_seq', COALESCE((SELECT MAX(id) FROM transactions), 1));
SELECT setval('support_id_seq', COALESCE((SELECT MAX(id) FROM support), 1));

-- =============================================
-- VERIFY SCHEMA
-- =============================================

-- Show all tables
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Show table sizes
SELECT 
    relname AS table_name,
    n_tup_ins AS rows_inserted,
    n_tup_upd AS rows_updated,
    n_tup_del AS rows_deleted
FROM pg_stat_user_tables
ORDER BY relname;

-- =============================================
-- END OF SCHEMA
-- =============================================

