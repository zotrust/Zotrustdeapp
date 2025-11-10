
import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, verifyWalletSignature, generateAuthToken, generateAdminToken } from '../middleware/auth';
import pool from '../config/database';
import { APIResponse } from '../types';
console.log(bcrypt.hashSync('admin123', 10));

const router = express.Router();

// Wallet-based authentication
router.post('/wallet-login', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Address, signature, and message are required'
      });
    }

    // Verify signature
    const isValidSignature = verifyWalletSignature(message, signature, address);
    if (!isValidSignature) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // Upsert user by unique address to avoid duplicates and PK conflicts
    await pool.query(
      `INSERT INTO users (address) VALUES ($1)
       ON CONFLICT (address) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
      [address.toLowerCase()]
    );

    const userResult = await pool.query('SELECT * FROM users WHERE address = $1', [address.toLowerCase()]);

    const user = userResult.rows[0];
    const token = generateAuthToken(address.toLowerCase());

    // Log authentication
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, ip_address) VALUES ($1, $2, $3)',
      [address.toLowerCase(), 'WALLET_LOGIN', req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: {
        user,
        token
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Wallet login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin login
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Get admin user
    const adminResult = await pool.query(
      'SELECT * FROM admin_users WHERE username = $1',
      [username]
    );

    if (adminResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const admin = adminResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const token = generateAdminToken(username);

    // Log admin login
    await pool.query(
      'INSERT INTO audit_logs (action, details, ip_address) VALUES ($1, $2, $3)',
      ['ADMIN_LOGIN', JSON.stringify({ username }), req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role
        },
        token
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const response: APIResponse = {
      success: true,
      data: req.user
    };

    res.json(response);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user by address (public endpoint for wallet disconnect scenario)
router.get('/user-by-address', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Address parameter is required'
      });
    }

    const result = await pool.query('SELECT * FROM users WHERE address = $1', [address.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    const response: APIResponse = {
      success: true,
      data: user
    };

    res.json(response);
  } catch (error) {
    console.error('Get user by address error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, async (req: any, res) => {
  try {
    // Log logout
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, ip_address) VALUES ($1, $2, $3)',
      [req.user.address, 'LOGOUT', req.ip]
    );

    const response: APIResponse = {
      success: true,
      message: 'Logged out successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all users (for review selection)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT address, name, created_at
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;


