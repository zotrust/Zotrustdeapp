-- Create chat_messages table
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

