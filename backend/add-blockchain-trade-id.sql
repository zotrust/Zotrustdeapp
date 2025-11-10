-- Add blockchain_trade_id column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS blockchain_trade_id INTEGER;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_blockchain_trade_id ON orders(blockchain_trade_id);

-- Add create_trade_tx_hash column to store the createTrade transaction hash
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS create_trade_tx_hash VARCHAR(66);

COMMENT ON COLUMN orders.blockchain_trade_id IS 'Trade ID from blockchain smart contract';
COMMENT ON COLUMN orders.create_trade_tx_hash IS 'Transaction hash from createTrade() call';
