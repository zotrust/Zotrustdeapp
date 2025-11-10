
import express from 'express';
import { authenticateToken } from '../middleware/auth';
import pool from '../config/database';
import { APIResponse } from '../types';

const router = express.Router();

// Get agents by location
router.get('/', async (req, res) => {
  try {
    const { location_id } = req.query;

    let query = `
      SELECT a.*, l.name as location_name
      FROM agents a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.verified = true
    `;
    const queryParams: any[] = [];

    if (location_id) {
      query += ' AND a.location_id = $1';
      queryParams.push(location_id);
    }

    query += ' ORDER BY a.branch_name ASC';

    const result = await pool.query(query, queryParams);

    const response: APIResponse = {
      success: true,
      data: result.rows
    };

    res.json(response);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get agent details
router.get('/:id', async (req, res) => {
  try {
    const agentId = req.params.id;

    const result = await pool.query(
      'SELECT * FROM agents WHERE id = $1 AND verified = true',
      [agentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const response: APIResponse = {
      success: true,
      data: result.rows[0]
    };

    res.json(response);
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get cities with agents
router.get('/cities/list', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT city FROM agents WHERE verified = true ORDER BY city ASC'
    );

    const cities = result.rows.map(row => row.city);

    const response: APIResponse = {
      success: true,
      data: cities
    };

    res.json(response);
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
