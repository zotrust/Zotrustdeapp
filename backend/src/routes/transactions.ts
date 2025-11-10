import express from 'express';
import { pool } from '../config/database';
import { APIResponse, Transaction } from '../types';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get transactions for a user
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    
    // Check if user is authenticated
    if (!user || !user.address) {
      console.log('❌ TRANSACTIONS: User not authenticated');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { limit = 20, offset = 0 } = req.query;
    
    console.log('💳 TRANSACTIONS: Fetching transactions for user:', user.address);
    
    const result = await pool.query(
      `SELECT t.*, o.amount, o.token, o.state as order_state,
              a.type as ad_type, a.price_inr
       FROM transactions t
       JOIN orders o ON t.order_id = o.id
       JOIN ads a ON o.ad_id = a.id
       WHERE (t.buyer_address = $1 OR t.seller_address = $1)
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.address, parseInt(limit), parseInt(offset)]
    );
    
    const transactions: Transaction[] = result.rows.map(row => ({
      id: row.id,
      transaction_number: row.transaction_number,
      order_id: row.order_id,
      buyer_address: row.buyer_address,
      seller_address: row.seller_address,
      amount: parseFloat(row.amount),
      token: row.token,
      transaction_type: row.transaction_type,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at
    }));
    
    console.log('✅ TRANSACTIONS: Found', transactions.length, 'transactions');
    
    const response: APIResponse = {
      success: true,
      data: transactions
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ TRANSACTIONS: Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get transaction by ID
router.get('/:id', async (req: any, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    console.log('💳 TRANSACTION: Fetching transaction:', id, 'for user:', user.address);
    
    const result = await pool.query(
      `SELECT t.*, o.amount, o.token, o.state as order_state,
              a.type as ad_type, a.price_inr,
              u1.name as buyer_name, u2.name as seller_name
       FROM transactions t
       JOIN orders o ON t.order_id = o.id
       JOIN ads a ON o.ad_id = a.id
       LEFT JOIN users u1 ON t.buyer_address = u1.address
       LEFT JOIN users u2 ON t.seller_address = u2.address
       WHERE t.id = $1 AND (t.buyer_address = $2 OR t.seller_address = $2)`,
      [id, user.address]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    const row = result.rows[0];
    const transaction: Transaction = {
      id: row.id,
      transaction_number: row.transaction_number,
      order_id: row.order_id,
      buyer_address: row.buyer_address,
      seller_address: row.seller_address,
      amount: parseFloat(row.amount),
      token: row.token,
      transaction_type: row.transaction_type,
      status: row.status,
      created_at: row.created_at,
      completed_at: row.completed_at
    };
    
    console.log('✅ TRANSACTION: Found transaction:', transaction.transaction_number);
    
    const response: APIResponse = {
      success: true,
      data: transaction
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ TRANSACTION: Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all transactions (admin only)
router.get('/admin/all', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    const { limit = 50, offset = 0, status } = req.query;
    
    // Check if user is admin (you might want to add proper admin check)
    console.log('💳 ADMIN TRANSACTIONS: Fetching all transactions for admin:', user.address);
    
    let query = `
      SELECT t.*, o.amount, o.token, o.state as order_state,
             a.type as ad_type, a.price_inr,
             u1.name as buyer_name, u2.name as seller_name
      FROM transactions t
      JOIN orders o ON t.order_id = o.id
      JOIN ads a ON o.ad_id = a.id
      LEFT JOIN users u1 ON t.buyer_address = u1.address
      LEFT JOIN users u2 ON t.seller_address = u2.address
    `;
    
    const params: any[] = [];
    let paramCount = 0;
    
    if (status) {
      query += ` WHERE t.status = $${++paramCount}`;
      params.push(status);
    }
    
    query += ` ORDER BY t.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    const transactions = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount)
    }));
    
    console.log('✅ ADMIN TRANSACTIONS: Found', transactions.length, 'transactions');
    
    const response: APIResponse = {
      success: true,
      data: transactions
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ ADMIN TRANSACTIONS: Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
