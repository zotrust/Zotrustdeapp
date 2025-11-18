-- Delete all agencies and locations that are NOT assigned to any user
-- This script safely skips any agents/locations that are in use

-- Step 1: Show summary before deletion
SELECT 
    'Total agents before deletion:' as info,
    COUNT(*) as count
FROM agents;

SELECT 
    'Total locations before deletion:' as info,
    COUNT(*) as count
FROM locations;

-- Step 2: Show agents that are assigned to users (will be skipped)
SELECT 
    'Agents assigned to users (WILL BE SKIPPED):' as info,
    COUNT(DISTINCT agent_id) as count
FROM (
    SELECT selected_agent_id::integer as agent_id
    FROM users
    WHERE selected_agent_id IS NOT NULL
    UNION
    SELECT unnest(selected_agent_ids::integer[]) as agent_id
    FROM users
    WHERE selected_agent_ids IS NOT NULL 
      AND array_length(selected_agent_ids, 1) > 0
) assigned_agents;

-- Step 3: Show locations that are assigned to users (will be skipped)
SELECT 
    'Locations assigned to users (WILL BE SKIPPED):' as info,
    COUNT(DISTINCT location_id) as count
FROM users
WHERE location_id IS NOT NULL;

-- Step 4: Delete agents that are NOT assigned to any user
-- Handle both selected_agent_id (single) and selected_agent_ids (TEXT[] array)
DELETE FROM agents
WHERE id NOT IN (
    -- Agents from selected_agent_id (single agent)
    SELECT DISTINCT selected_agent_id::integer
    FROM users
    WHERE selected_agent_id IS NOT NULL
    
    UNION
    
    -- Agents from selected_agent_ids (TEXT[] array - convert to integer)
    SELECT DISTINCT unnest(selected_agent_ids::integer[])
    FROM users
    WHERE selected_agent_ids IS NOT NULL 
      AND array_length(selected_agent_ids, 1) > 0
);

-- Step 5: Delete locations that are NOT assigned to any user
DELETE FROM locations
WHERE id NOT IN (
    SELECT DISTINCT location_id
    FROM users
    WHERE location_id IS NOT NULL
);

-- Step 6: Show final counts after deletion
SELECT 
    'Remaining agents (assigned to users):' as info,
    COUNT(*) as count
FROM agents;

SELECT 
    'Remaining locations (assigned to users):' as info,
    COUNT(*) as count
FROM locations;
