-- Add EXPIRED state to orders table constraint
-- This migration adds 'EXPIRED' to the allowed states in the orders table

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_state_check;

-- Add the new constraint with EXPIRED state
ALTER TABLE orders ADD CONSTRAINT orders_state_check 
CHECK (state IN ('CREATED', 'ACCEPTED', 'LOCKED', 'RELEASED', 'CANCELLED', 'EXPIRED', 'DISPUTED', 'REFUNDED'));

-- Verify the change
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'orders_state_check';

