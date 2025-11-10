-- Dispute Resolution System Database Schema
-- Phase 1: Initial Confirmation (0-2 hours)
-- Phase 2: Appeal Window (2-48 hours) 
-- Phase 3: Resolution Window (2-48 hours)
-- Phase 4: Admin Resolution (within 48 hours)

-- 1. Payment Confirmations Table
CREATE TABLE IF NOT EXISTS payment_confirmations (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    buyer_confirmed BOOLEAN DEFAULT FALSE,
    seller_confirmed BOOLEAN DEFAULT FALSE,
    buyer_confirmed_at TIMESTAMP NULL,
    seller_confirmed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Disputes Table
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dispute_type VARCHAR(20) NOT NULL CHECK (dispute_type IN ('PAYMENT_NOT_RECEIVED', 'PAYMENT_NOT_SENT', 'OTHER')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(42) NULL, -- Admin address
    resolution VARCHAR(20) NULL CHECK (resolution IN ('TRANSFER_TO_BUYER', 'REFUND_TO_SELLER', 'SPLIT_REFUND')),
    resolution_reason TEXT NULL,
    created_by VARCHAR(42) NOT NULL -- Who created the dispute
);

-- 3. Appeals Table
CREATE TABLE IF NOT EXISTS appeals (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    appellant_address VARCHAR(42) NOT NULL, -- Who filed the appeal
    appellant_type VARCHAR(10) NOT NULL CHECK (appellant_type IN ('BUYER', 'SELLER')),
    description TEXT NOT NULL,
    evidence_video_url TEXT NULL,
    evidence_screenshots TEXT[] NULL, -- Array of screenshot URLs
    evidence_documents TEXT[] NULL, -- Array of document URLs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'))
);

-- 4. Dispute Timeline Table
CREATE TABLE IF NOT EXISTS dispute_timeline (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER NULL REFERENCES disputes(id) ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(30) NOT NULL,
    event_description TEXT NOT NULL,
    created_by VARCHAR(42) NULL, -- User address or 'SYSTEM'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB NULL -- Additional event data
);

-- 5. Admin Notifications Table
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_confirmations_order_id ON payment_confirmations(order_id);

-- Add unique constraint for ON CONFLICT support
ALTER TABLE payment_confirmations ADD CONSTRAINT payment_confirmations_order_id_unique UNIQUE (order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_appeals_dispute_id ON appeals(dispute_id);
CREATE INDEX IF NOT EXISTS idx_appeals_order_id ON appeals(order_id);
CREATE INDEX IF NOT EXISTS idx_appeals_appellant ON appeals(appellant_address);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_dispute_id ON dispute_timeline(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_order_id ON dispute_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_dispute_id ON admin_notifications(dispute_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);

-- Add dispute-related columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmation_id INTEGER REFERENCES payment_confirmations(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispute_id INTEGER REFERENCES disputes(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS appeal_deadline TIMESTAMP NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS resolution_deadline TIMESTAMP NULL;

-- Update orders state to include dispute states
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_state_check;
ALTER TABLE orders ADD CONSTRAINT orders_state_check 
    CHECK (state IN ('CREATED', 'ACCEPTED', 'LOCKED', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'REFUNDED', 'UNDER_REVIEW', 'APPEALED', 'RESOLVED', 'CONFIRMED'));

-- Comments for documentation
COMMENT ON TABLE payment_confirmations IS 'Tracks payment confirmations from both buyer and seller';
COMMENT ON TABLE disputes IS 'Main disputes table for tracking dispute resolution process';
COMMENT ON TABLE appeals IS 'Individual appeals filed by buyers or sellers';
COMMENT ON TABLE dispute_timeline IS 'Audit trail of all dispute-related events';
COMMENT ON TABLE admin_notifications IS 'Notifications for admin dashboard';

COMMENT ON COLUMN payment_confirmations.buyer_confirmed IS 'Whether buyer confirmed payment was sent';
COMMENT ON COLUMN payment_confirmations.seller_confirmed IS 'Whether seller confirmed payment was received';
COMMENT ON COLUMN disputes.dispute_type IS 'Type of dispute: payment not received, payment not sent, or other';
COMMENT ON COLUMN disputes.resolution IS 'Final resolution: transfer to buyer, refund to seller, or split refund';
COMMENT ON COLUMN appeals.appellant_type IS 'Whether the appeal was filed by buyer or seller';
COMMENT ON COLUMN appeals.evidence_video_url IS 'URL to video evidence uploaded by appellant';
COMMENT ON COLUMN dispute_timeline.event_type IS 'Type of event: APPEAL_FILED, ADMIN_REVIEW, RESOLUTION, etc.';
COMMENT ON COLUMN admin_notifications.priority IS 'Priority level for admin attention';
