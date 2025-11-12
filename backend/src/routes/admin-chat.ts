import express from 'express';
import pool from '../config/database';
import { authenticateAdmin, AdminRequest } from '../middleware/auth';
import Joi from 'joi';

const router = express.Router();

// Get all users with chat history
router.get('/users', authenticateAdmin, async (req: AdminRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
        cm.user_address,
        u.name as user_name,
        u.phone as user_phone,
        COUNT(CASE WHEN cm.sender_type = 'admin' AND cm.is_read = false THEN 1 END) as unread_from_user,
        MAX(cm.created_at) as last_message_at,
        (SELECT message FROM chat_messages 
         WHERE user_address = cm.user_address 
         ORDER BY created_at DESC LIMIT 1) as last_message
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_address = u.address
      GROUP BY cm.user_address, u.name, u.phone
      ORDER BY last_message_at DESC NULLS LAST`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get chat users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get messages for a specific user
router.get('/messages/:userAddress', authenticateAdmin, async (req: AdminRequest, res) => {
  try {
    const { userAddress } = req.params;

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

    // Mark admin messages as read
    await pool.query(
      `UPDATE chat_messages 
       SET is_read = true 
       WHERE user_address = $1 AND sender_type = 'admin' AND is_read = false`,
      [userAddress.toLowerCase()]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get user messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Send message from admin to user
router.post('/send', authenticateAdmin, async (req: AdminRequest, res) => {
  try {
    const schema = Joi.object({
      user_address: Joi.string().required(),
      message: Joi.string().required().max(1000)
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const adminId = req.admin.id; // From authenticateAdmin middleware
    const { user_address, message } = value;

    const result = await pool.query(
      `INSERT INTO chat_messages (user_address, admin_id, message, sender_type, is_read)
       VALUES ($1, $2, $3, 'admin', false)
       RETURNING *`,
      [user_address.toLowerCase(), adminId, message]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Admin send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Mark user messages as read (admin side)
router.post('/mark-read/:userAddress', authenticateAdmin, async (req: AdminRequest, res) => {
  try {
    const { userAddress } = req.params;

    await pool.query(
      `UPDATE chat_messages 
       SET is_read = true 
       WHERE user_address = $1 AND sender_type = 'user' AND is_read = false`,
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

// Get unread message count (admin side - all users)
router.get('/unread-count', authenticateAdmin, async (req: AdminRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE sender_type = 'user' AND is_read = false`
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

