-- Add UNDER_DISPUTE state to orders table constraint
-- This migration adds 'UNDER_DISPUTE' to the allowed states in the orders table
-- Note: This is different from 'DISPUTED' which may be used elsewhere

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_state_check;

-- Add the new constraint with UNDER_DISPUTE state
-- Includes all states: original states + dispute states + UNDER_DISPUTE
ALTER TABLE orders ADD CONSTRAINT orders_state_check 
CHECK (state IN (
    'CREATED', 
    'ACCEPTED', 
    'LOCKED', 
    'RELEASED', 
    'CANCELLED', 
    'EXPIRED', 
    'DISPUTED',
    'UNDER_DISPUTE',  -- NEW: Added for dispute resolution workflow
    'UNDER_REVIEW', 
    'APPEALED', 
    'RESOLVED', 
    'CONFIRMED',
    'REFUNDED'
));

-- Verify the change
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'orders_state_check';

-- Show current constraint definition
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'orders'::regclass
    AND conname = 'orders_state_check';

