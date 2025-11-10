-- Reviews Table for User Feedback System
-- Allows users to leave reviews and admins to control visibility

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    reviewer_address VARCHAR(42) NOT NULL,
    reviewee_address VARCHAR(42) NOT NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    message TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER REFERENCES admin_users(id),
    approved_at TIMESTAMP,
    FOREIGN KEY (reviewer_address) REFERENCES users(address),
    FOREIGN KEY (reviewee_address) REFERENCES users(address)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_address);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_address);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON reviews(is_visible);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved);

-- Comments
COMMENT ON TABLE reviews IS 'User reviews and ratings for completed trades';
COMMENT ON COLUMN reviews.reviewer_address IS 'Address of user who wrote the review';
COMMENT ON COLUMN reviews.reviewee_address IS 'Address of user being reviewed';
COMMENT ON COLUMN reviews.order_id IS 'Order that this review is for';
COMMENT ON COLUMN reviews.rating IS 'Rating from 1-5 stars';
COMMENT ON COLUMN reviews.message IS 'Optional review message';
COMMENT ON COLUMN reviews.is_visible IS 'Whether review is visible to public';
COMMENT ON COLUMN reviews.is_approved IS 'Whether review is approved by admin';
COMMENT ON COLUMN reviews.approved_by IS 'Admin who approved the review';
COMMENT ON COLUMN reviews.approved_at IS 'When the review was approved';
