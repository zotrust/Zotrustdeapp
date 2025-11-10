import express from 'express';
import pool from '../config/database';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Get all reviews (Admin)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    console.log('Admin reviews endpoint called');
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT r.*, 
             u1.name as reviewer_name,
             u2.name as reviewee_name,
             o.id as order_id,
             o.amount,
             o.token,
             o.state as order_state,
             a.username as approved_by_username
      FROM reviews r
      LEFT JOIN users u1 ON r.reviewer_address = u1.address
      LEFT JOIN users u2 ON r.reviewee_address = u2.address
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN admin_users a ON r.approved_by = a.id
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (status === 'pending') {
      query += ` AND r.is_approved = false`;
    } else if (status === 'approved') {
      query += ` AND r.is_approved = true`;
    } else if (status === 'hidden') {
      query += ` AND r.is_visible = false`;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);
    console.log('Admin reviews query result:', result.rows.length, 'reviews found');

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get admin reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Approve review (Admin)
router.post('/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = 1; // Default admin ID

    const result = await pool.query(`
      UPDATE reviews 
      SET is_approved = true, 
          approved_by = $1, 
          approved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [adminId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Review approved successfully'
    });
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Hide/Show review (Admin)
router.post('/:id/toggle-visibility', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE reviews 
      SET is_visible = NOT is_visible,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    const review = result.rows[0];
    res.json({
      success: true,
      data: review,
      message: `Review ${review.is_visible ? 'shown' : 'hidden'} successfully`
    });
  } catch (error) {
    console.error('Toggle review visibility error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete review (Admin)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM reviews 
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get review statistics (Admin)
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN is_approved = false THEN 1 END) as pending_reviews,
        COUNT(CASE WHEN is_visible = false THEN 1 END) as hidden_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
      FROM reviews
    `);

    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        total_reviews: parseInt(stats.total_reviews),
        approved_reviews: parseInt(stats.approved_reviews),
        pending_reviews: parseInt(stats.pending_reviews),
        hidden_reviews: parseInt(stats.hidden_reviews),
        average_rating: parseFloat(stats.average_rating || 0).toFixed(1),
        rating_breakdown: {
          5: parseInt(stats.five_star_count),
          4: parseInt(stats.four_star_count),
          3: parseInt(stats.three_star_count),
          2: parseInt(stats.two_star_count),
          1: parseInt(stats.one_star_count)
        }
      }
    });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
