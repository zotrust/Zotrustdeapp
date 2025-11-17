-- =============================================
-- ZOTRUST P2P TRADING PLATFORM
-- Complete Production-Ready Database Schema
-- =============================================
-- Version: 3.0 (VPS Ready)
-- Last Updated: 2025-11-17
-- Description: Complete schema with all tables, dispute system, and blockchain integration
-- =============================================

-- =============================================
-- HOW TO USE THIS FILE ON VPS:
-- =============================================
-- 1. Login to your VPS
-- 2. Create database: createdb -U postgres p2p_dapp
-- 3. Run this file: psql -U postgres -d p2p_dapp -f VPS_DATABASE_SCHEMA.sql
-- =============================================

-- Set timezone to UTC
SET TIMEZONE='UTC';

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

-- =============================================
-- 2. USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL UNIQUE,
    name VARCHAR(255),
    phone VARCHAR(20),
    mobile VARCHAR(20),
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
COMMENT ON COLUMN users.mobile IS 'User mobile number for KYC/contact';

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
    location_name VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    created_by_admin VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE agents IS 'Agent branches for cash exchange';

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
    owner_selected_agent_ids TEXT[],
    type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    token VARCHAR(10) NOT NULL CHECK (token IN ('BNB', 'TBNB', 'WBNB', 'USDT', 'USDC')),
    price_inr DECIMAL(18, 2) NOT NULL,
    min_amount DECIMAL(18, 6) NOT NULL,
    max_amount DECIMAL(18, 6) NOT NULL,
    sell_quantity DECIMAL(18, 6),
    buy_quantity DECIMAL(18, 6),
    lock_duration_seconds INTEGER DEFAULT 7200,
    city VARCHAR(255),
    location_id INTEGER REFERENCES locations(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE ads IS 'P2P trading advertisements';
COMMENT ON COLUMN ads.lock_duration_seconds IS 'Lock duration in seconds (default 2 hours = 7200s)';

CREATE INDEX IF NOT EXISTS idx_ads_owner ON ads(owner_address);
CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(active);
CREATE INDEX IF NOT EXISTS idx_ads_type ON ads(type);
CREATE INDEX IF NOT EXISTS idx_ads_token ON ads(token);
CREATE INDEX IF NOT EXISTS idx_ads_city ON ads(city);

-- =============================================
-- 5. ORDERS TABLE (WITH COUNTDOWN & BLOCKCHAIN)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    ad_id INTEGER NOT NULL REFERENCES ads(id),
    buyer_address VARCHAR(42) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    token VARCHAR(10) NOT NULL,
    state VARCHAR(20) DEFAULT 'CREATED' CHECK (
        state IN ('CREATED', 'ACCEPTED', 'LOCKED', 'RELEASED', 'CANCELLED', 'EXPIRED', 
                  'UNDER_DISPUTE', 'UNDER_REVIEW', 'APPEALED', 'RESOLVED', 'CONFIRMED', 
                  'REFUNDED', 'COMPLETED')
    ),
    agent_branch VARCHAR(255),
    agent_number VARCHAR(20),
    agent_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timezone VARCHAR(255) DEFAULT 'Asia/Kolkata',
    start_datetime_string VARCHAR(255),
    accepted_at TIMESTAMP,
    lock_expires_at TIMESTAMP,
    otp_hash VARCHAR(255),
    tx_hash VARCHAR(66),
    blockchain_trade_id INTEGER,
    create_trade_tx_hash VARCHAR(66),
    payment_confirmation_id INTEGER,
    dispute_id INTEGER,
    appeal_deadline TIMESTAMP,
    resolution_deadline TIMESTAMP
);

COMMENT ON TABLE orders IS 'Trading orders with blockchain integration';
COMMENT ON COLUMN orders.start_time IS 'UTC timestamp when order was created';
COMMENT ON COLUMN orders.state IS 'Order workflow state (includes dispute states)';
COMMENT ON COLUMN orders.blockchain_trade_id IS 'Trade ID from smart contract';
COMMENT ON COLUMN orders.create_trade_tx_hash IS 'TX hash for createTrade transaction';

CREATE INDEX IF NOT EXISTS idx_orders_ad ON orders(ad_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_address);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_address);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);
CREATE INDEX IF NOT EXISTS idx_orders_start_time ON orders(start_time);
CREATE INDEX IF NOT EXISTS idx_orders_blockchain_trade_id ON orders(blockchain_trade_id);

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

CREATE INDEX IF NOT EXISTS idx_otp_logs_order ON otp_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_logs(user_address);

-- =============================================
-- 7. TRANSACTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    transaction_number VARCHAR(100) UNIQUE,
    buyer_address VARCHAR(42) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    amount DECIMAL(18, 6) NOT NULL,
    token VARCHAR(10) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL,
    type VARCHAR(20),
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING',
    block_number BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

COMMENT ON TABLE transactions IS 'Transaction records for orders';

CREATE INDEX IF NOT EXISTS idx_tx_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_tx_number ON transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_tx_buyer ON transactions(buyer_address);
CREATE INDEX IF NOT EXISTS idx_tx_seller ON transactions(seller_address);

-- =============================================
-- 8. PAYMENT CONFIRMATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payment_confirmations (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    buyer_confirmed BOOLEAN DEFAULT FALSE,
    seller_confirmed BOOLEAN DEFAULT FALSE,
    buyer_confirmed_at TIMESTAMP NULL,
    seller_confirmed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE payment_confirmations IS 'Tracks payment confirmations from both parties';

CREATE INDEX IF NOT EXISTS idx_payment_confirmations_order_id ON payment_confirmations(order_id);

-- Add reference from orders to payment_confirmations
ALTER TABLE orders ADD CONSTRAINT fk_orders_payment_confirmation 
    FOREIGN KEY (payment_confirmation_id) REFERENCES payment_confirmations(id);

-- =============================================
-- 9. DISPUTES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dispute_type VARCHAR(30) NOT NULL CHECK (dispute_type IN ('PAYMENT_NOT_RECEIVED', 'PAYMENT_NOT_SENT', 'OTHER')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(42) NULL,
    resolution VARCHAR(30) NULL CHECK (resolution IN ('TRANSFER_TO_BUYER', 'REFUND_TO_SELLER', 'SPLIT_REFUND')),
    resolution_reason TEXT NULL,
    created_by VARCHAR(42) NOT NULL
);

COMMENT ON TABLE disputes IS 'Dispute records for order conflicts';

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Add reference from orders to disputes
ALTER TABLE orders ADD CONSTRAINT fk_orders_dispute 
    FOREIGN KEY (dispute_id) REFERENCES disputes(id);

-- =============================================
-- 10. APPEALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS appeals (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    appellant_address VARCHAR(42) NOT NULL,
    appellant_type VARCHAR(10) NOT NULL CHECK (appellant_type IN ('BUYER', 'SELLER')),
    description TEXT NOT NULL,
    evidence_video_url TEXT NULL,
    evidence_screenshots TEXT[] NULL,
    evidence_documents TEXT[] NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED', 'RESOLVED'))
);

COMMENT ON TABLE appeals IS 'Appeal records filed by buyers or sellers';

CREATE INDEX IF NOT EXISTS idx_appeals_dispute_id ON appeals(dispute_id);
CREATE INDEX IF NOT EXISTS idx_appeals_order_id ON appeals(order_id);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant ON appeals(appellant_address);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);

-- =============================================
-- 11. DISPUTE TIMELINE TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS dispute_timeline (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER NULL REFERENCES disputes(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    event_description TEXT NOT NULL,
    created_by VARCHAR(42) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NULL
);

COMMENT ON TABLE dispute_timeline IS 'Audit trail of dispute events';

CREATE INDEX IF NOT EXISTS idx_dispute_timeline_dispute_id ON dispute_timeline(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_order_id ON dispute_timeline(order_id);

-- =============================================
-- 12. ADMIN NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    notification_type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'ACTED_UPON')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    acted_at TIMESTAMP NULL
);

COMMENT ON TABLE admin_notifications IS 'Notifications for admin dashboard';

CREATE INDEX IF NOT EXISTS idx_admin_notifications_dispute_id ON admin_notifications(dispute_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);

-- =============================================
-- 13. REVIEWS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    reviewer_address VARCHAR(42) NOT NULL,
    reviewee_address VARCHAR(42) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE reviews IS 'User reviews and ratings';

CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_address);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_address);

-- =============================================
-- 14. CALLS TABLE
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

CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_address);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_address);

-- =============================================
-- 15. AUDIT LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit_logs IS 'Activity audit trail';

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_address);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- =============================================
-- 16. SUPPORT TABLE
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

CREATE INDEX IF NOT EXISTS idx_support_user ON support(user_address);
CREATE INDEX IF NOT EXISTS idx_support_status ON support(status);

-- =============================================
-- 17. ADMIN USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(42) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'ADMIN',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE admin_users IS 'Admin panel users';

-- =============================================
-- 18. APP SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE app_settings IS 'Application configuration settings';

-- =============================================
-- 19. CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    admin_id INTEGER REFERENCES admin_users(id),
    message TEXT NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('user', 'admin')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_address) REFERENCES users(address)
);

COMMENT ON TABLE chat_messages IS 'Chat messages between users and admin';

CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_address);
CREATE INDEX IF NOT EXISTS idx_chat_admin ON chat_messages(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

-- =============================================
-- INSERT DEFAULT DATA
-- =============================================

-- Default Locations (Major Indian Cities)
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
    ('LOCK_PAYMENT_TIMEOUT_HOURS', '2', 'Hours to complete payment after locking funds'),
    ('APPEAL_WINDOW_HOURS', '48', 'Hours to file appeal after lock expires'),
    ('PLATFORM_FEE_PERCENTAGE', '0.5', 'Platform fee percentage'),
    ('MIN_ORDER_AMOUNT_BNB', '0.01', 'Minimum order amount in BNB'),
    ('MIN_ORDER_AMOUNT_USDT', '10', 'Minimum order amount in USDT'),
    ('WEBSOCKET_HEARTBEAT_INTERVAL_MS', '30000', 'WebSocket heartbeat interval'),
    ('ENABLE_MAINTENANCE_MODE', 'false', 'Enable/disable maintenance mode'),
    ('trading_buy_enabled', 'true', 'Enable/disable BUY trading'),
    ('trading_sell_enabled', 'true', 'Enable/disable SELL trading'),
    ('trading_start_time', '00:00', 'Trading start time (24-hour format)'),
    ('trading_end_time', '23:59', 'Trading end time (24-hour format)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =============================================
-- CREATE UPDATE TIMESTAMP TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ads_updated_at ON ads;
CREATE TRIGGER update_ads_updated_at 
    BEFORE UPDATE ON ads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_support_updated_at ON support;
CREATE TRIGGER update_support_updated_at 
    BEFORE UPDATE ON support 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_confirmations_updated_at ON payment_confirmations;
CREATE TRIGGER update_payment_confirmations_updated_at 
    BEFORE UPDATE ON payment_confirmations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ALIGN SEQUENCES (Prevent ID Conflicts)
-- =============================================

SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval('agents_id_seq', COALESCE((SELECT MAX(id) FROM agents), 1));
SELECT setval('ads_id_seq', COALESCE((SELECT MAX(id) FROM ads), 1));
SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1));
SELECT setval('otp_logs_id_seq', COALESCE((SELECT MAX(id) FROM otp_logs), 1));
SELECT setval('transactions_id_seq', COALESCE((SELECT MAX(id) FROM transactions), 1));
SELECT setval('payment_confirmations_id_seq', COALESCE((SELECT MAX(id) FROM payment_confirmations), 1));
SELECT setval('disputes_id_seq', COALESCE((SELECT MAX(id) FROM disputes), 1));
SELECT setval('appeals_id_seq', COALESCE((SELECT MAX(id) FROM appeals), 1));
SELECT setval('dispute_timeline_id_seq', COALESCE((SELECT MAX(id) FROM dispute_timeline), 1));
SELECT setval('admin_notifications_id_seq', COALESCE((SELECT MAX(id) FROM admin_notifications), 1));
SELECT setval('reviews_id_seq', COALESCE((SELECT MAX(id) FROM reviews), 1));
SELECT setval('calls_id_seq', COALESCE((SELECT MAX(id) FROM calls), 1));
SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 1));
SELECT setval('support_id_seq', COALESCE((SELECT MAX(id) FROM support), 1));
SELECT setval('admin_users_id_seq', COALESCE((SELECT MAX(id) FROM admin_users), 1));
SELECT setval('app_settings_id_seq', COALESCE((SELECT MAX(id) FROM app_settings), 1));
SELECT setval('locations_id_seq', COALESCE((SELECT MAX(id) FROM locations), 1));
SELECT setval('chat_messages_id_seq', COALESCE((SELECT MAX(id) FROM chat_messages), 1));

-- =============================================
-- VERIFY SCHEMA
-- =============================================

-- Show all tables
\echo '=== DATABASE TABLES ==='
SELECT tablename, schemaname 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- =============================================
-- END OF SCHEMA
-- =============================================
-- Schema successfully created!
-- Next steps:
-- 1. Create admin user using /api/admin/register endpoint
-- 2. Add agents through admin panel
-- 3. Configure app_settings as needed
-- 4. Start the application
-- =============================================

