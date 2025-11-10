-- Reset all appeals and disputes to PENDING status for testing
-- This script will:
-- 1. Set all disputes.status to 'PENDING'
-- 2. Clear resolution fields (resolution, resolution_reason, resolved_at, resolved_by)
-- 3. Optionally set appeals.status to 'PENDING' if the field exists

-- Step 1: Reset disputes status to PENDING
UPDATE disputes 
SET 
  status = 'PENDING',
  resolution = NULL,
  resolution_reason = NULL,
  resolved_at = NULL,
  resolved_by = NULL
WHERE status = 'RESOLVED' OR status = 'CLOSED';

-- Step 2: Reset appeals status to PENDING (if status column exists)
-- Note: Check if appeals table has status column before running
UPDATE appeals 
SET status = 'PENDING'
WHERE status != 'PENDING' OR status IS NULL;

-- Step 3: Show summary
SELECT 
  'Disputes updated' as table_name,
  COUNT(*) as count,
  status
FROM disputes
GROUP BY status
UNION ALL
SELECT 
  'Appeals updated' as table_name,
  COUNT(*) as count,
  COALESCE(status::text, 'NULL') as status
FROM appeals
GROUP BY status;

