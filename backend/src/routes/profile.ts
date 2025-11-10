import express from 'express';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth';
import pool from '../config/database';
import { APIResponse } from '../types';

const router = express.Router();

// Validation schema for multiple agent selection
const updateProfileSchema = Joi.object({
  name: Joi.string().max(255).optional(),
  phone: Joi.string().max(20).optional(),
  location_id: Joi.number().integer().positive().optional(),
  selected_agent_ids: Joi.array().items(Joi.number().integer().positive()).optional()
});

// Update profile
router.put('/', authenticateToken, async (req: any, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const user = req.user;
    const profileData = value;

    // Validate selected agents if provided
    if (profileData.selected_agent_ids && profileData.selected_agent_ids.length > 0) {
      const agentResult = await pool.query(
        'SELECT * FROM agents WHERE id = ANY($1) AND verified = true',
        [profileData.selected_agent_ids]
      );

      if (agentResult.rows.length !== profileData.selected_agent_ids.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more selected agents are invalid or not verified'
        });
      }

      // Check if all agents are from the same location (if location is being updated)
      if (profileData.location_id) {
        const locationResult = await pool.query(
          'SELECT DISTINCT location_id FROM agents WHERE id = ANY($1)',
          [profileData.selected_agent_ids]
        );

        if (locationResult.rows.length > 1 || 
            (locationResult.rows.length === 1 && locationResult.rows[0].location_id !== profileData.location_id)) {
          return res.status(400).json({
            success: false,
            error: 'All selected agents must be from the same location'
          });
        }
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (profileData.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(profileData.name);
      paramIndex++;
    }

    if (profileData.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      values.push(profileData.phone);
      paramIndex++;
    }

    if (profileData.location_id !== undefined) {
      updates.push(`location_id = $${paramIndex}`);
      // Convert string to integer for PostgreSQL
      values.push(parseInt(profileData.location_id.toString(), 10));
      paramIndex++;
    }

    if (profileData.selected_agent_ids !== undefined) {
      updates.push(`selected_agent_ids = $${paramIndex}`);
      // Convert to array of strings for PostgreSQL TEXT[] column
      const agentIdsArray = Array.isArray(profileData.selected_agent_ids) 
        ? profileData.selected_agent_ids.map(id => id.toString())
        : [profileData.selected_agent_ids.toString()];
      values.push(agentIdsArray);
      paramIndex++;
    }

    // Set verified to true if location and agents are selected
    if (profileData.location_id && profileData.selected_agent_ids && profileData.selected_agent_ids.length > 0) {
      updates.push(`verified = true`);
      updates.push(`verified_at = NOW()`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(user.address);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE address = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    // Log profile update
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.address, 'UPDATE_PROFILE', 'user', profileData, req.ip]
    );

    // Format the response data - PostgreSQL TEXT[] is already returned as JavaScript array by pg library
    const userData = result.rows[0];
    // No conversion needed - pg library automatically converts PostgreSQL arrays to JavaScript arrays

    const response: APIResponse = {
      success: true,
      data: userData,
      message: 'Profile updated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get profile
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;

    // Get user with agent details
    const result = await pool.query(
      `SELECT u.*, 
              COALESCE(
                (SELECT json_agg(
                  json_build_object(
                    'id', a.id,
                    'branch_name', a.branch_name,
                    'mobile', a.mobile,
                    'address', a.address,
                    'location_id', a.location_id,
                    'location_name', l.name
                  )
                )
                FROM agents a
                LEFT JOIN locations l ON a.location_id = l.id
                WHERE a.id = ANY(u.selected_agent_ids)
                AND a.verified = true
                ), '[]'::json
              ) as selected_agents
       FROM users u
       WHERE u.address = $1`,
      [user.address]
    );

    const response: APIResponse = {
      success: true,
      data: result.rows[0]
    };

    res.json(response);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;