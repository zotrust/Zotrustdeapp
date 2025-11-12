-- Delete Reviews from Database Script
-- This SQL script deletes reviews from the database
-- 
-- Usage: psql -U your_username -d your_database -f backend/scripts/delete-reviews-from-db.sql
-- 
-- To delete specific number of reviews, modify the LIMIT value below

-- Show count before deletion
SELECT COUNT(*) as reviews_before_deletion FROM reviews;

-- Delete 14 oldest reviews (modify LIMIT to change the number)
DELETE FROM reviews 
WHERE id IN (
  SELECT id FROM reviews 
  ORDER BY created_at ASC 
  LIMIT 14
);

-- Show count after deletion
SELECT COUNT(*) as reviews_after_deletion FROM reviews;

-- Optional: Show remaining reviews
-- SELECT id, reviewer_address, rating, LEFT(message, 50) as message_preview, created_at 
-- FROM reviews 
-- ORDER BY created_at DESC 
-- LIMIT 10;

