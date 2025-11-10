-- Add WBNB token to ads table constraint
-- Run this migration if you get "token violates check constraint" error

-- Drop the old constraint
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_token_check;

-- Add new constraint with WBNB included
ALTER TABLE ads ADD CONSTRAINT ads_token_check CHECK (token IN ('TBNB', 'WBNB', 'USDT', 'USDC'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'ads_token_check';


