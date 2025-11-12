import express from 'express';
import pool from '../config/database';
import { authenticateToken } from '../middleware/auth';
import Joi from 'joi';

const router = express.Router();

// Get chat messages for a user
router.get('/messages', authenticateToken, async (req: any, res) => {
  try {
    const userAddress = req.user.address;

    const result = await pool.query(
      `SELECT 
        cm.*,
        u.name as user_name,
        au.username as admin_username
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_address = u.address
      LEFT JOIN admin_users au ON cm.admin_id = au.id
      WHERE cm.user_address = $1
      ORDER BY cm.created_at ASC`,
      [userAddress.toLowerCase()]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Send a message (user to admin)
router.post('/send', authenticateToken, async (req: any, res) => {
  try {
    const schema = Joi.object({
      message: Joi.string().required().max(1000)
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const userAddress = req.user.address;
    const { message } = value;

    const result = await pool.query(
      `INSERT INTO chat_messages (user_address, message, sender_type, is_read)
       VALUES ($1, $2, 'user', false)
       RETURNING *`,
      [userAddress.toLowerCase(), message]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Mark messages as read
router.post('/mark-read', authenticateToken, async (req: any, res) => {
  try {
    const userAddress = req.user.address;

    await pool.query(
      `UPDATE chat_messages 
       SET is_read = true 
       WHERE user_address = $1 AND sender_type = 'admin' AND is_read = false`,
      [userAddress.toLowerCase()]
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get unread message count
router.get('/unread-count', authenticateToken, async (req: any, res) => {
  try {
    const userAddress = req.user.address;

    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE user_address = $1 AND sender_type = 'admin' AND is_read = false`,
      [userAddress.toLowerCase()]
    );

    res.json({
      success: true,
      data: {
        unread_count: parseInt(result.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;

