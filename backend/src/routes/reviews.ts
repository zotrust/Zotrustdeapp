import express from 'express';
import pool from '../config/database';
import Joi from 'joi';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all reviews
router.get('/all', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT r.*, 
             u1.name as reviewer_name,
             u2.name as reviewee_name,
             o.id as order_id,
             o.amount,
             o.token
      FROM reviews r
      LEFT JOIN users u1 ON LOWER(r.reviewer_address) = LOWER(u1.address)
      LEFT JOIN users u2 ON LOWER(r.reviewee_address) = LOWER(u2.address)
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE r.is_visible = true
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get reviews for a user (reviews about them)
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(`
      SELECT r.*, 
             u1.name as reviewer_name,
             u2.name as reviewee_name,
             o.id as order_id,
             o.amount,
             o.token
      FROM reviews r
      LEFT JOIN users u1 ON LOWER(r.reviewer_address) = LOWER(u1.address)
      LEFT JOIN users u2 ON LOWER(r.reviewee_address) = LOWER(u2.address)
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE LOWER(r.reviewee_address) = LOWER($1)
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [address, limit, offset]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create a new review
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const reviewSchema = Joi.object({
      reviewee_address: Joi.string().required(),
      order_id: Joi.number().integer().optional(),
      rating: Joi.number().integer().min(1).max(5).required(),
      message: Joi.string().max(500).optional().allow('')
    });

    const { error, value } = reviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { reviewee_address, order_id, rating, message } = value;
    const reviewer_address = req.user.address; // Set by auth middleware

    // Normalize addresses to lowercase for consistent comparison
    const normalizedRevieweeAddress = reviewee_address.toLowerCase();
    const normalizedReviewerAddress = reviewer_address.toLowerCase();

    // Allow users to review the platform (themselves) for website feedback
    // This is for general platform reviews, not user-to-user reviews

    // If order_id is provided, validate the order
    if (order_id) {
      // Check if order exists and user is involved
      const orderResult = await pool.query(`
        SELECT buyer_address, seller_address, state 
        FROM orders 
        WHERE id = $1
      `, [order_id]);

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      const order = orderResult.rows[0];
      if (order.state !== 'RELEASED') {
        return res.status(400).json({
          success: false,
          error: 'Can only review completed orders'
        });
      }

      // Check if user is involved in the order
      if (order.buyer_address.toLowerCase() !== normalizedReviewerAddress && order.seller_address.toLowerCase() !== normalizedReviewerAddress) {
        return res.status(403).json({
          success: false,
          error: 'You can only review orders you participated in'
        });
      }

      // Check if user is trying to review the other party in the order
      const otherParty = order.buyer_address.toLowerCase() === normalizedReviewerAddress ? order.seller_address : order.buyer_address;
      if (normalizedRevieweeAddress !== otherParty.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Can only review the other party in the order'
        });
      }

      // Check if review already exists for this order
      const existingReview = await pool.query(`
        SELECT id FROM reviews 
        WHERE LOWER(reviewer_address) = $1 AND order_id = $2
      `, [normalizedReviewerAddress, order_id]);

      if (existingReview.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Review already exists for this order'
        });
      }
    } else {
      // For general reviews (no order_id), check if user has already reviewed this person
      const existingGeneralReview = await pool.query(`
        SELECT id FROM reviews 
        WHERE LOWER(reviewer_address) = $1 AND LOWER(reviewee_address) = $2 AND order_id IS NULL
      `, [normalizedReviewerAddress, normalizedRevieweeAddress]);

      if (existingGeneralReview.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'You have already left a general review for this user'
        });
      }
    }

    // Create review
    const result = await pool.query(`
      INSERT INTO reviews (reviewer_address, reviewee_address, order_id, rating, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [normalizedReviewerAddress, normalizedRevieweeAddress, order_id, rating, message || '']);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Review submitted successfully'
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get total review statistics (all reviews)
router.get('/stats/total', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
      FROM reviews 
      WHERE is_visible = true
    `);

    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        total_reviews: parseInt(stats.total_reviews),
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
    console.error('Get total review stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's review statistics
router.get('/stats/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
      FROM reviews 
      WHERE LOWER(reviewee_address) = LOWER($1)
    `, [address]);

    const stats = result.rows[0];
    
    res.json({
      success: true,
      data: {
        total_reviews: parseInt(stats.total_reviews),
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
