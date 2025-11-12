
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import pool from '../config/database';
import { JWTPayload, User } from '../types';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
 

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024') as JWTPayload;
    
    // Get user from database
    const userResult = await pool.query('SELECT * FROM users WHERE address = $1', [decoded.address]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
};

export interface AdminRequest extends Request {
  admin?: {
    id: number;
    username: string;
  };
}

export const authenticateAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'Admin access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024') as any;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    // Support both username and email in token (for backward compatibility)
    const identifier = decoded.username || decoded.email;
    
    if (!identifier) {
      return res.status(401).json({ success: false, error: 'Invalid token: missing username/email' });
    }

    // Get admin from database - try username first, then email
    let adminResult = await pool.query(
      'SELECT id, username FROM admin_users WHERE username = $1',
      [identifier]
    );
    
    // If not found by username and token has email, try to find by email (if we add email column later)
    if (adminResult.rows.length === 0 && decoded.email) {
      // For now, if username is email format, try to find admin with username matching email
      adminResult = await pool.query(
        'SELECT id, username FROM admin_users WHERE username = $1 OR username = $2',
        [decoded.email, 'admin']
      );
    }
    
    // If still not found and we have adminId in token, use that
    if (adminResult.rows.length === 0 && decoded.adminId) {
      adminResult = await pool.query(
        'SELECT id, username FROM admin_users WHERE id = $1',
        [decoded.adminId]
      );
    }
    
    // If still not found, create default admin for backward compatibility
    if (adminResult.rows.length === 0) {
      // This handles the case where admin_users table might not have the default admin
      // For now, we'll allow the request if token has valid admin role
      // But ideally, admin should exist in database
      console.warn('⚠️ Admin not found in database, but token is valid. Using token adminId if available.');
      
      if (decoded.adminId) {
        req.admin = {
          id: decoded.adminId,
          username: decoded.username || decoded.email || 'admin'
        };
      } else {
        // Fallback: create a temporary admin object
        req.admin = {
          id: 1,
          username: identifier
        };
      }
    } else {
      req.admin = adminResult.rows[0];
    }
    
    next();
  } catch (error: any) {
    console.error('Admin auth - Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token. Please login again.' });
    }
    return res.status(403).json({ success: false, error: 'Invalid admin token' });
  }
};

export const verifyWalletSignature = (message: string, signature: string, address: string): boolean => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

export const generateAuthToken = (address: string): string => {
  return jwt.sign(
    { address },
    process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024',
    { expiresIn: '7d' }
  );
};

export const generateAdminToken = (username: string): string => {
  return jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024',
    { expiresIn: '24h' }
  );
};
