
import express from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth';
import pool from '../config/database';
import { APIResponse, CreateAdRequest } from '../types';

const router = express.Router();

// Validation schemas
const createAdSchema = Joi.object({
  type: Joi.string().valid('BUY', 'SELL').required(),
  token: Joi.string().valid('TBNB', 'WBNB', 'USDT', 'USDC').required(),
  price_inr: Joi.number().positive().required(),
  min_amount: Joi.number().positive().required(),
  max_amount: Joi.number().positive().required(),
  sell_quantity: Joi.number().positive().optional().allow(null),
  buy_quantity: Joi.number().positive().optional().allow(null),
  lock_duration_seconds: Joi.number().integer().min(300).max(86400).default(3600),
  city: Joi.alternatives().try(Joi.string().max(100), Joi.number()).optional(),
  selected_agent_ids: Joi.array().items(Joi.string()).min(1).required(),
  blockchain_trade_id: Joi.string().optional(),
  creation_tx_hash: Joi.string().optional()
});

// Get ads with agent filtering
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const { type, token, city, limit = 50, offset = 0 } = req.query;
    const user = req.user;

    // In development mode, ensure mock agents exist
    if (process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true') {
      try {
        // Check if agents exist, if not create them
        const agentCheck = await pool.query('SELECT COUNT(*) FROM agents');
        const agentCount = parseInt(agentCheck.rows[0].count);
        
        if (agentCount === 0) {
          console.log('Development Mode: Creating mock agents in database');
          await pool.query(`
            INSERT INTO agents (branch_name, city, address, mobile, verified, created_by_admin, created_at, updated_at)
            VALUES 
              ('Mumbai Central', 'Mumbai', '123 Main Street, Mumbai', '+91 9876543210', true, 1, NOW(), NOW()),
              ('Delhi North', 'Delhi', '456 Park Avenue, Delhi', '+91 9876543211', true, 1, NOW(), NOW()),
              ('Bangalore Tech', 'Bangalore', '789 IT Park, Bangalore', '+91 9876543212', true, 1, NOW(), NOW())
          `);
        }
      } catch (error) {
        console.error('Error creating mock agents:', error);
      }
    }

    // Check if user has selected agents
    if (!user.selected_agent_ids || user.selected_agent_ids.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'Profile verify karein aur ek agent select karein — tabhi aapko local P2P ads dikhengi.'
      });
    }

    // Filter: Only show ads where ad owner's agent branch_name matches with current user's agent branch_name
    // Also filter by available quantity (sell_quantity > 0 for SELL ads, buy_quantity > 0 for BUY ads)
    
    // Get current user's agent branch names (case-insensitive matching)
    // IMPORTANT: Only show ads where ad owner has at least one agent with the SAME branch_name
    // Location doesn't matter - only agent branch_name matching matters
    const userAgentIds = (user.selected_agent_ids || []).map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id));
    let userAgentBranchNames: string[] = [];
    let userAgentDetails: Array<{id: number, branch_name: string}> = [];
    
    if (userAgentIds.length > 0) {
      const userAgentsResult = await pool.query(
        `SELECT id, branch_name FROM agents WHERE id = ANY($1::int[])`,
        [userAgentIds]
      );
      userAgentDetails = userAgentsResult.rows.map((row: any) => ({
        id: row.id,
        branch_name: row.branch_name?.trim()
      })).filter((agent: any) => agent.branch_name && agent.branch_name.length > 0);
      
      userAgentBranchNames = userAgentDetails
        .map((agent: any) => agent.branch_name.toLowerCase()); // Normalize to lowercase for comparison
    }
    
    console.log('🔍 AD FILTERING - User Agents:', {
      userAddress: user.address,
      userAgentIds,
      userAgentDetails: userAgentDetails.map(a => ({ id: a.id, branch_name: a.branch_name })),
      normalizedBranchNames: userAgentBranchNames
    });
    
    // If user has no agents or no branch names, return empty array
    if (userAgentBranchNames.length === 0) {
      console.log('❌ No user agent branch names found - returning empty ads');
      return res.json({
        success: true,
        data: [],
        message: 'No matching agents found. Please select agents with matching branch names.'
      });
    }
    
    // Build explicit branch name matching condition
    // Only show ads where ad owner's agent branch_name matches user's agent branch_name
    const branchNameConditions = userAgentBranchNames.map((_, index) => 
      `LOWER(TRIM(ad_owner_agent.branch_name)) = $${index + 2}`
    ).join(' OR ');
    
    let query = `
      SELECT a.*, u.name as owner_name, u.selected_agent_ids,
             ag.branch_name, ag.mobile as agent_mobile, ag.address as agent_address
      FROM ads a
      JOIN users u ON a.owner_address = u.address
      JOIN agents ag ON a.owner_selected_agent_id = ag.id
      WHERE a.active = true 
        AND a.owner_address != $1
        AND u.selected_agent_ids IS NOT NULL
        AND array_length(u.selected_agent_ids::int[], 1) > 0
        AND (
          -- Check if ad owner has any agent with matching branch_name (case-insensitive)
          -- Only match by branch_name, not by agent ID
          EXISTS (
            SELECT 1 
            FROM agents ad_owner_agent
            WHERE ad_owner_agent.id = ANY(u.selected_agent_ids::int[])
              AND (${branchNameConditions})
          )
        )
        AND (
          -- For SELL ads: show only if sell_quantity > 0 or sell_quantity is NULL (unlimited)
          (a.type = 'SELL' AND (a.sell_quantity IS NULL OR CAST(a.sell_quantity AS DECIMAL) > 0))
          OR
          -- For BUY ads: show only if buy_quantity > 0 or buy_quantity is NULL (unlimited)
          (a.type = 'BUY' AND (a.buy_quantity IS NULL OR CAST(a.buy_quantity AS DECIMAL) > 0))
        )
    `;
    
    // Build query params: [user.address, ...userAgentBranchNames, ...otherParams]
    const queryParams: any[] = [user.address, ...userAgentBranchNames];
    let paramIndex = queryParams.length + 1;

    if (type) {
      query += ` AND a.type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    if (token) {
      query += ` AND a.token = $${paramIndex}`;
      queryParams.push(token);
      paramIndex++;
    }

    if (city) {
      query += ` AND a.city ILIKE $${paramIndex}`;
      queryParams.push(`%${city}%`);
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    console.log('📊 EXECUTING QUERY:', {
      query: query.substring(0, 200) + '...',
      params: queryParams.slice(0, 10), // Show first 10 params to avoid too much output
      totalParams: queryParams.length,
      userBranchNames: userAgentBranchNames,
      paramBreakdown: {
        userAddress: queryParams[0],
        branchNames: queryParams.slice(1, 1 + userAgentBranchNames.length),
        otherParams: queryParams.slice(1 + userAgentBranchNames.length)
      }
    });

    const result = await pool.query(query, queryParams);
    
    // IMPORTANT: Post-query filtering to ensure only ads with matching branch_name are returned
    // This is a safety check in case the SQL query doesn't filter correctly
    const filteredRows = await Promise.all(result.rows.map(async (ad: any) => {
      // Get ad owner's agent details
      const ownerAgentsResult = await pool.query(
        `SELECT id, branch_name FROM agents WHERE id = ANY($1::int[])`,
        [ad.selected_agent_ids || []]
      );
      const ownerAgents = ownerAgentsResult.rows.map((row: any) => ({
        id: row.id,
        branch_name: row.branch_name?.trim()
      }));
      
      // Check if any owner agent branch_name matches user's agent branch_name (case-insensitive)
      const hasMatchingBranchName = ownerAgents.some((agent: any) => {
        const ownerBranchName = agent.branch_name?.toLowerCase().trim();
        return userAgentBranchNames.includes(ownerBranchName);
      });
      
      return {
        ad,
        ownerAgents,
        hasMatchingBranchName
      };
    }));
    
    // Filter out ads that don't have matching branch names
    const validAds = filteredRows
      .filter((item: any) => item.hasMatchingBranchName)
      .map((item: any) => item.ad);
    
    // Log detailed matching information
    const matchedAds = filteredRows.map((item: any) => {
      const matchingAgents = item.ownerAgents.filter((agent: any) => 
        userAgentBranchNames.includes(agent.branch_name?.toLowerCase().trim())
      );
      
      return {
        id: item.ad.id,
        owner: item.ad.owner_name,
        ownerAgentIds: item.ad.selected_agent_ids,
        ownerAgents: item.ownerAgents,
        matchingAgents: matchingAgents,
        hasMatchingBranchName: item.hasMatchingBranchName,
        reason: item.hasMatchingBranchName
          ? `✅ Matched: ${matchingAgents.map((a: any) => a.branch_name).join(', ')}`
          : '❌ No match - filtered out'
      };
    });
    
    console.log('✅ QUERY RESULT - Filtering Summary:', {
      totalAdsFromQuery: result.rows.length,
      validAdsAfterFiltering: validAds.length,
      userAgentBranchNames: userAgentDetails.map(a => a.branch_name),
      matchedAds: matchedAds
    });
    
    // Use filtered ads instead of raw query result
    result.rows = validAds;

    // Process results to get all agents for each ad
    const processedAds = await Promise.all(result.rows.map(async (ad) => {
      // Get all agents for this user
      const agentsResult = await pool.query(
        `SELECT ag.* FROM agents ag 
         WHERE ag.id = ANY($1::int[])`,
        [ad.selected_agent_ids || []]
      );
      
      return {
        ...ad,
        agents: agentsResult.rows.map(agent => ({
          id: agent.id,
          branch_name: agent.branch_name,
          mobile: agent.mobile,
          address: agent.address,
          city: agent.city || ad.city || 'Unknown', // Use ad city as fallback
          verified: agent.verified
        }))
      };
    }));

    const response: APIResponse = {
      success: true,
      data: processedAds
    };

    res.json(response);
  } catch (error) {
    console.error('Get ads error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new ad
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { error, value } = createAdSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const user = req.user;

    // Check if user is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        error: 'Profile verification required to create ads'
      });
    }

    // Check if user has selected agents
    if (!user.selected_agent_ids || user.selected_agent_ids.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Agent selection required to create ads'
      });
    }

    const adData: CreateAdRequest = value;

    // Convert city to string if it's a number
    const cityString = typeof adData.city === 'number' ? adData.city.toString() : adData.city;

    // Get the first selected agent ID (for backward compatibility)
    const primaryAgentId = adData.selected_agent_ids[0];

    // In development mode, ensure the mock user exists in the database
    if (process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true') {
      try {
        // Check if user exists, if not create them
        const userCheck = await pool.query('SELECT id FROM users WHERE address = $1', [user.address]);
        
        if (userCheck.rows.length === 0) {
          console.log('Development Mode: Creating mock user in database');
          await pool.query(
            `INSERT INTO users (address, name, phone, city, selected_agent_id, verified, verified_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              user.address,
              user.name || 'Development User',
              user.phone || '+91 9876543210',
              cityString || user.city || 'Mumbai',
              primaryAgentId || user.selected_agent_id || 1,
              true,
              new Date(),
              new Date(),
              new Date()
            ]
          );
        }
      } catch (error) {
        console.error('Error creating mock user:', error);
      }
    }

    // Insert ad into database
    const result = await pool.query(
      `INSERT INTO ads (owner_address, owner_selected_agent_id, type, token, price_inr, min_amount, max_amount, sell_quantity, buy_quantity, lock_duration_seconds, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        user.address,
        primaryAgentId,
        adData.type,
        adData.token,
        adData.price_inr,
        adData.min_amount,
        adData.max_amount,
        adData.sell_quantity || null,
        adData.buy_quantity || null,
        adData.lock_duration_seconds || 3600,
        cityString || user.city
      ]
    );

    // Log ad creation
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.address, 'CREATE_AD', 'ad', result.rows[0].id.toString(), req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: result.rows[0],
      message: 'Ad created successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's own ads
router.get('/my-ads', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;

    const result = await pool.query(
      `SELECT a.*, ag.branch_name, ag.mobile as agent_mobile
       FROM ads a
       LEFT JOIN agents ag ON a.owner_selected_agent_id = ag.id
       WHERE a.owner_address = $1
       ORDER BY a.created_at DESC`,
      [user.address]
    );

    const response: APIResponse = {
      success: true,
      data: result.rows
    };

    res.json(response);
  } catch (error) {
    console.error('Get my ads error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update ad
router.patch('/:id', authenticateToken, async (req: any, res) => {
  try {
    const adId = req.params.id;
    const user = req.user;
    const { active, price_inr, min_amount, max_amount } = req.body;

    // Check if ad belongs to user
    const adResult = await pool.query(
      'SELECT * FROM ads WHERE id = $1 AND owner_address = $2',
      [adId, user.address]
    );

    if (adResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found or access denied'
      });
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (active !== undefined) {
      updates.push(`active = $${paramIndex}`);
      values.push(active);
      paramIndex++;
    }

    if (price_inr !== undefined) {
      updates.push(`price_inr = $${paramIndex}`);
      values.push(price_inr);
      paramIndex++;
    }

    if (min_amount !== undefined) {
      updates.push(`min_amount = $${paramIndex}`);
      values.push(min_amount);
      paramIndex++;
    }

    if (max_amount !== undefined) {
      updates.push(`max_amount = $${paramIndex}`);
      values.push(max_amount);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(adId);

    const query = `UPDATE ads SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    // Log ad update
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.address, 'UPDATE_AD', 'ad', adId, JSON.stringify(req.body), req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: result.rows[0],
      message: 'Ad updated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete ad
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const adId = req.params.id;
    const user = req.user;

    // Check if ad belongs to user and has no active orders
    const adResult = await pool.query(
      `SELECT a.*, COUNT(o.id) as active_orders
       FROM ads a
       LEFT JOIN orders o ON a.id = o.ad_id AND o.state IN ('CREATED', 'ACCEPTED', 'LOCKED')
       WHERE a.id = $1 AND a.owner_address = $2
       GROUP BY a.id`,
      [adId, user.address]
    );

    if (adResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ad not found or access denied'
      });
    }

    if (parseInt(adResult.rows[0].active_orders) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete ad with active orders'
      });
    }

    // Soft delete (set active to false)
    await pool.query(
      'UPDATE ads SET active = false, updated_at = NOW() WHERE id = $1',
      [adId]
    );

    // Log ad deletion
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.address, 'DELETE_AD', 'ad', adId, req.ip]
    );

    const response: APIResponse = {
      success: true,
      message: 'Ad deleted successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
