import express from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Get all locations (public endpoint)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, created_at
      FROM locations
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations'
    });
  }
});

export default router;
