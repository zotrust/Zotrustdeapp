-- Fix selected_agent_ids column type from JSONB to INTEGER ARRAY

-- First, check if we need to convert the column type
DO $$ 
BEGIN
    -- Drop the column if it's JSONB and recreate as integer array
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' 
        AND column_name='selected_agent_ids' 
        AND udt_name='jsonb'
    ) THEN
        -- Backup any existing data
        ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_agent_ids_backup JSONB;
        UPDATE users SET selected_agent_ids_backup = selected_agent_ids WHERE selected_agent_ids IS NOT NULL;
        
        -- Drop the JSONB column
        ALTER TABLE users DROP COLUMN selected_agent_ids;
        
        -- Add new INTEGER[] column
        ALTER TABLE users ADD COLUMN selected_agent_ids INTEGER[];
        
        -- Try to migrate data from backup if it was a valid array
        UPDATE users 
        SET selected_agent_ids = ARRAY(
            SELECT jsonb_array_elements_text(selected_agent_ids_backup)::INTEGER
        )
        WHERE selected_agent_ids_backup IS NOT NULL 
        AND jsonb_typeof(selected_agent_ids_backup) = 'array';
        
        -- Migrate from old selected_agent_id if selected_agent_ids is still null
        UPDATE users 
        SET selected_agent_ids = ARRAY[selected_agent_id::INTEGER]
        WHERE selected_agent_id IS NOT NULL 
        AND (selected_agent_ids IS NULL OR selected_agent_ids = '{}');
        
        -- Drop backup column
        ALTER TABLE users DROP COLUMN IF EXISTS selected_agent_ids_backup;
        
        RAISE NOTICE 'Converted selected_agent_ids from JSONB to INTEGER[]';
    END IF;
END $$;

-- Create index for selected_agent_ids array
DROP INDEX IF EXISTS idx_users_selected_agents;
CREATE INDEX idx_users_selected_agents ON users USING GIN(selected_agent_ids);

-- Verify the change
DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT udt_name INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'selected_agent_ids';
    
    RAISE NOTICE 'selected_agent_ids column type is now: %', col_type;
END $$;

