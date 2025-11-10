-- Update reviews table to make order_id optional for general reviews
ALTER TABLE reviews ALTER COLUMN order_id DROP NOT NULL;

-- Add a comment to clarify the change
COMMENT ON COLUMN reviews.order_id IS 'Optional order ID - NULL for general platform reviews, set for order-specific reviews';

-- Add an index for better performance when querying general reviews
CREATE INDEX IF NOT EXISTS idx_reviews_order_id_null ON reviews(order_id) WHERE order_id IS NULL;
