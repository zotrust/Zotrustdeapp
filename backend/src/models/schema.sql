
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20),
    city VARCHAR(100),
    location_id INTEGER,
    selected_agent_id BIGINT,
    selected_agent_ids TEXT[],
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    branch_name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    address VARCHAR(500),
    mobile VARCHAR(20),
    verified BOOLEAN DEFAULT FALSE,
    created_by_admin INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ads table
CREATE TABLE IF NOT EXISTS ads (
    id SERIAL PRIMARY KEY,
    owner_address VARCHAR(42) NOT NULL,
    owner_selected_agent_id BIGINT,
    type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    token VARCHAR(10) NOT NULL CHECK (token IN ('TBNB', 'USDT', 'USDC')),
    price_inr DECIMAL(15,2) NOT NULL,
    min_amount DECIMAL(18,6) NOT NULL,
    max_amount DECIMAL(18,6) NOT NULL,
    sell_quantity DECIMAL(18,6),
    buy_quantity DECIMAL(18,6),
    lock_duration_seconds INTEGER DEFAULT 3600,
    city VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_address) REFERENCES users(address),
    FOREIGN KEY (owner_selected_agent_id) REFERENCES agents(id)
);

-- Orders table (with countdown feature)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    ad_id INTEGER NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    token VARCHAR(10) NOT NULL,
    state VARCHAR(20) DEFAULT 'CREATED' CHECK (state IN ('CREATED', 'ACCEPTED', 'LOCKED', 'RELEASED', 'CANCELLED', 'EXPIRED', 'UNDER_DISPUTE', 'REFUNDED')),
    agent_branch VARCHAR(255),
    agent_number VARCHAR(20),
    agent_address VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timezone VARCHAR(255),
    start_datetime_string VARCHAR(255),
    accepted_at TIMESTAMP,
    lock_expires_at TIMESTAMP,
    otp_hash VARCHAR(66), -- SHA-256 hash of OTP for fund release
    tx_hash VARCHAR(66),
    FOREIGN KEY (ad_id) REFERENCES ads(id),
    FOREIGN KEY (buyer_address) REFERENCES users(address),
    FOREIGN KEY (seller_address) REFERENCES users(address)
);

COMMENT ON COLUMN orders.start_time IS 'UTC timestamp when order was created (for countdown)';
COMMENT ON COLUMN orders.timezone IS 'User timezone (e.g., Asia/Calcutta)';
COMMENT ON COLUMN orders.start_datetime_string IS 'Formatted display time with timezone';

-- OTP logs table
CREATE TABLE IF NOT EXISTS otp_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    user_address VARCHAR(42),
    otp_hash VARCHAR(66) NOT NULL, -- SHA-256 hash of OTP
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calls table for in-app calling
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    caller_address VARCHAR(42) NOT NULL,
    receiver_address VARCHAR(42) NOT NULL,
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'active', 'ended', 'failed')),
    signaling_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (caller_address) REFERENCES users(address),
    FOREIGN KEY (receiver_address) REFERENCES users(address)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER
);

-- Support table for multiple support numbers and emails
CREATE TABLE IF NOT EXISTS support (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('phone', 'email')),
    value VARCHAR(255) NOT NULL,
    label VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table for order transactions
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INTEGER NOT NULL,
    buyer_address VARCHAR(42) NOT NULL,
    seller_address VARCHAR(42) NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    token VARCHAR(10) NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (buyer_address) REFERENCES users(address),
    FOREIGN KEY (seller_address) REFERENCES users(address)
);

-- Reviews table for platform reviews
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    reviewer_address VARCHAR(42) NOT NULL,
    reviewee_address VARCHAR(42) NOT NULL,
    reviewer_name VARCHAR(255),
    reviewee_name VARCHAR(255),
    order_id INTEGER,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    message TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reviewer_address) REFERENCES users(address),
    FOREIGN KEY (reviewee_address) REFERENCES users(address),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_address ON users(address);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_id);
CREATE INDEX IF NOT EXISTS idx_users_selected_agents ON users USING GIN(selected_agent_ids);
CREATE INDEX IF NOT EXISTS idx_agents_location ON agents(location_id);
CREATE INDEX IF NOT EXISTS idx_ads_owner_agent ON ads(owner_selected_agent_id);
CREATE INDEX IF NOT EXISTS idx_ads_active_city ON ads(active, city);
CREATE INDEX IF NOT EXISTS idx_orders_state ON orders(state);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_address);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_address);
CREATE INDEX IF NOT EXISTS idx_otp_logs_order ON otp_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_calls_participants ON calls(caller_address, receiver_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_address);
CREATE INDEX IF NOT EXISTS idx_support_active ON support(active, priority);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer_address);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_address);
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_address);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_address);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved, is_visible);

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (username, password_hash, role) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert default app settings
INSERT INTO app_settings (key, value) VALUES 
('admin_fee_wallet', ''),
('buyer_fee_percent', '0.01'),
('seller_fee_percent', '0.01'),
('accept_timeout_minutes', '5'),
('lock_duration_hours', '1')
ON CONFLICT (key) DO NOTHING;

-- Insert default locations
INSERT INTO locations (name, state, country, active) VALUES 
('Mumbai', 'Maharashtra', 'India', true),
('Delhi', 'Delhi', 'India', true),
('Bangalore', 'Karnataka', 'India', true),
('Hyderabad', 'Telangana', 'India', true),
('Pune', 'Maharashtra', 'India', true),
('Kolkata', 'West Bengal', 'India', true),
('Chennai', 'Tamil Nadu', 'India', true),
('Ahmedabad', 'Gujarat', 'India', true)
ON CONFLICT DO NOTHING;

-- Insert default support contacts
INSERT INTO support (type, value, label, priority) VALUES 
('phone', '+91-9876543210', 'Primary Support', 1),
('phone', '+91-9876543211', 'Secondary Support', 2),
('email', 'support@zotrust.com', 'Primary Email', 1),
('email', 'help@zotrust.com', 'Secondary Email', 2)
ON CONFLICT DO NOTHING;

-- Chat messages table
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
COMMENT ON COLUMN chat_messages.user_address IS 'User wallet address';
COMMENT ON COLUMN chat_messages.admin_id IS 'Admin user ID (NULL if message from user)';
COMMENT ON COLUMN chat_messages.sender_type IS 'Who sent the message: user or admin';
COMMENT ON COLUMN chat_messages.is_read IS 'Whether message has been read';

-- Indexes for chat
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_address);
CREATE INDEX IF NOT EXISTS idx_chat_admin ON chat_messages(admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_read ON chat_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_chat_user_created ON chat_messages(user_address, created_at);
