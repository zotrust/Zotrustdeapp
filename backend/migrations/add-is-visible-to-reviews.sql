-- Add is_visible column to reviews table
-- This allows admin to hide/show reviews

ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_reviews_is_visible ON reviews(is_visible);

-- Comment for documentation
COMMENT ON COLUMN reviews.is_visible IS 'Whether the review is visible to users (admin can hide inappropriate reviews)';

-- Show result
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'reviews' 
  AND column_name = 'is_visible';

