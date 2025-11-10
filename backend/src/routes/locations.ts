import express from 'express';
import { pool } from '../config/database';
import { authenticateAdmin } from '../middleware/auth';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createLocationSchema = Joi.object({
  name: Joi.string().max(255).required()
});

const updateLocationSchema = Joi.object({
  name: Joi.string().max(255).optional()
});

// GET /api/locations - Get all locations
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT l.*, 
             COUNT(a.id) as agent_count
      FROM locations l
      LEFT JOIN agents a ON l.id = a.location_id
    `;
    
    const conditions = [];
    const params = [];
    let paramCount = 0;
    
    if (name) {
      conditions.push(`l.name ILIKE $${++paramCount}`);
      params.push(`%${name}%`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += `
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations'
    });
  }
});

// GET /api/locations/:id - Get location by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT l.*, 
             COUNT(a.id) as agent_count,
             ARRAY_AGG(
               CASE WHEN a.id IS NOT NULL THEN
                 json_build_object(
                   'id', a.id,
                   'branch_name', a.branch_name,
                   'mobile', a.mobile,
                   'verified', a.verified
                 )
               END
             ) FILTER (WHERE a.id IS NOT NULL) as agents
      FROM locations l
      LEFT JOIN agents a ON l.id = a.location_id
      WHERE l.id = $1
      GROUP BY l.id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location'
    });
  }
});

// POST /api/locations - Create new location
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { error, value } = createLocationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    const { name } = value;
    
    const result = await pool.query(`
      INSERT INTO locations (name)
      VALUES ($1)
      RETURNING *
    `, [name]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Location created successfully'
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create location'
    });
  }
});

// PUT /api/locations/:id - Update location
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateLocationSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    
    const updateFields = [];
    const params = [];
    let paramCount = 0;
    
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updateFields.push(`${key} = $${++paramCount}`);
        params.push(val);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    
    const result = await pool.query(`
      UPDATE locations 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
});

// DELETE /api/locations/:id - Delete location
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if location has agents
    const agentCheck = await pool.query(
      'SELECT COUNT(*) as agent_count FROM agents WHERE location_id = $1',
      [id]
    );
    
    if (parseInt(agentCheck.rows[0].agent_count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete location with assigned agents'
      });
    }
    
    const result = await pool.query(
      'DELETE FROM locations WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Location deleted successfully'
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete location'
    });
  }
});

export default router;
