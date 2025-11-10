
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

export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];



    if (!token) {
      return res.status(401).json({ success: false, error: 'Admin access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024') as any;
    // console.log('Admin auth - Decoded token:', decoded);
    
    if (decoded.role !== 'admin') {
      // console.log('Admin auth - Role check failed. Expected: admin, Got:', decoded.role);
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    
    next();
  } catch (error) {
    // console.error('Admin auth - Error:', error);
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
