import express from 'express';
import multer from 'multer';
import Joi from 'joi';
import * as path from 'path';
import * as fs from 'fs';
import { authenticateToken } from '../middleware/auth';
import pool from '../config/database';
import { ContractService } from '../services/contractService';
import { APIResponse } from '../types';

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `appeal-${uniqueSuffix}-${file.originalname}`);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for evidence
    cb(null, true);
  }
});

const router = express.Router();
const contractService = new ContractService();

// Validation schemas
const confirmPaymentSchema = Joi.object({
  confirmation_type: Joi.string().valid('PAYMENT_SENT', 'PAYMENT_RECEIVED').required()
});

const createAppealSchema = Joi.object({
  // dispute_type: Joi.string().valid('PAYMENT_NOT_RECEIVED', 'PAYMENT_NOT_SENT', 'OTHER').required(),
  dispute_type: Joi.string().optional(),
  description: Joi.string().min(10).max(1000).required(),
  evidence_video_url: Joi.string().optional().allow(null),
  evidence_screenshots: Joi.array().items(Joi.string().uri()).optional().allow(null),
  evidence_documents: Joi.array().items(Joi.string().uri()).optional().allow(null)
});

const adminResolutionSchema = Joi.object({
  resolution: Joi.string().valid('TRANSFER_TO_BUYER', 'REFUND_TO_SELLER', 'SPLIT_REFUND').required(),
  resolution_reason: Joi.string().min(10).max(500).required()
});

// Phase 1: Initial Confirmation (0-2 Hours)
// Buyer confirms payment sent
router.post('/:orderId/confirm-payment-sent', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.orderId;
    const user = req.user;
    
    console.log('🔄 CONFIRM PAYMENT SENT: Starting payment confirmation');
    console.log('👤 CONFIRM PAYMENT SENT: User:', user.address);
    console.log('📝 CONFIRM PAYMENT SENT: Order ID:', orderId);

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if user is the buyer
    if (order.buyer_address.toLowerCase() !== user.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Only the buyer can confirm payment sent'
      });
    }

    // Check if order is in LOCKED state
    if (order.state !== 'LOCKED') {
      return res.status(400).json({
        success: false,
        error: 'Order must be in LOCKED state to confirm payment'
      });
    }

    // Check if 2 hours have passed
    const lockTime = new Date(order.lock_expires_at).getTime();
    const now = Date.now();
    const timeRemaining = lockTime - now;

    if (timeRemaining <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation window has expired. Please file an appeal.'
      });
    }

    // Create or update payment confirmation
    const confirmationResult = await pool.query(
      `INSERT INTO payment_confirmations (order_id, buyer_confirmed, buyer_confirmed_at)
       VALUES ($1, true, $2)
       ON CONFLICT (order_id) 
       DO UPDATE SET 
         buyer_confirmed = true, 
         buyer_confirmed_at = $2,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [orderId, new Date()]
    );

    // On-chain confirmation must be done by the buyer's wallet on the frontend (markPaid)

    // Check if both parties have confirmed
    const confirmation = confirmationResult.rows[0];
    if (confirmation.seller_confirmed) {
      // Both confirmed - release funds
      // Both on-chain confirmations should auto-release. Record off-chain timeline only.
      await pool.query(
        'UPDATE orders SET state = $1 WHERE id = $2',
        ['RELEASED', orderId]
      );

      await pool.query(
        `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by)
         VALUES (NULL, $1, 'BOTH_CONFIRMED', 'Both buyer and seller confirmed payment', 'SYSTEM')`,
        [orderId]
      );

      return res.json({
        success: true,
        data: {
          orderId: parseInt(orderId),
          state: 'RELEASED',
          message: 'Payment confirmed by both parties. Funds released!'
        }
      });
    }

    // Log timeline event
    await pool.query(
      `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by)
       VALUES (NULL, $1, 'BUYER_CONFIRMED', 'Buyer confirmed payment sent', $2)`,
      [orderId, user.address]
    );

    res.json({
      success: true,
      data: {
        orderId: parseInt(orderId),
        buyerConfirmed: true,
        sellerConfirmed: confirmation.seller_confirmed,
        timeRemaining: Math.max(0, timeRemaining),
        message: 'Payment confirmation recorded. Waiting for seller confirmation.'
      }
    });

  } catch (error) {
    console.error('Confirm payment sent error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Seller confirms payment received
router.post('/:orderId/confirm-payment-received', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.orderId;
    const user = req.user;
    
    console.log('🔄 CONFIRM PAYMENT RECEIVED: Starting payment confirmation');
    console.log('👤 CONFIRM PAYMENT RECEIVED: User:', user.address);
    console.log('📝 CONFIRM PAYMENT RECEIVED: Order ID:', orderId);

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if user is the seller
    if (order.seller_address.toLowerCase() !== user.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Only the seller can confirm payment received'
      });
    }

    // Check if order is in LOCKED state
    if (order.state !== 'LOCKED') {
      return res.status(400).json({
        success: false,
        error: 'Order must be in LOCKED state to confirm payment'
      });
    }

    // Check if 2 hours have passed
    const lockTime = new Date(order.lock_expires_at).getTime();
    const now = Date.now();
    const timeRemaining = lockTime - now;

    if (timeRemaining <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Confirmation window has expired. Please file an appeal.'
      });
    }

    // Create or update payment confirmation
    const confirmationResult = await pool.query(
      `INSERT INTO payment_confirmations (order_id, seller_confirmed, seller_confirmed_at)
       VALUES ($1, true, $2)
       ON CONFLICT (order_id) 
       DO UPDATE SET 
         seller_confirmed = true, 
         seller_confirmed_at = $2,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [orderId, new Date()]
    );

    // NEW CONTRACT FLOW: Seller's confirmReceived() on blockchain already released funds
    // So we immediately update order status to RELEASED
    // Buyer confirmation is off-chain only, so seller's confirmation is sufficient
    console.log('✅ CONFIRM PAYMENT RECEIVED: Seller confirmed - updating order status to RELEASED');
    console.log('💡 NEW FLOW: Seller\'s confirmReceived() already released funds on blockchain');
    
    // Update order status to RELEASED immediately
      await pool.query(
        'UPDATE orders SET state = $1 WHERE id = $2',
        ['RELEASED', orderId]
      );

    const confirmation = confirmationResult.rows[0];
    
    // Log timeline event
    if (confirmation.buyer_confirmed) {
      // Both confirmed
      await pool.query(
        `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by)
         VALUES (NULL, $1, 'BOTH_CONFIRMED', 'Both buyer and seller confirmed payment. Funds released on blockchain.', 'SYSTEM')`,
        [orderId]
      );
    } else {
      // Seller confirmed (buyer confirmation is off-chain only)
    await pool.query(
      `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by)
         VALUES (NULL, $1, 'SELLER_CONFIRMED', 'Seller confirmed payment received and released funds on blockchain', $2)`,
      [orderId, user.address]
    );
    }

    console.log('🎉 CONFIRM PAYMENT RECEIVED: Order status updated to RELEASED');

    res.json({
      success: true,
      data: {
        orderId: parseInt(orderId),
        state: 'RELEASED',
        buyerConfirmed: confirmation.buyer_confirmed || false,
        sellerConfirmed: true,
        message: 'Payment confirmed! Funds have been released on blockchain.'
      }
    });

  } catch (error) {
    console.error('Confirm payment received error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Phase 2: Appeal Window (2-48 Hours)
// Create appeal
router.post('/:orderId/appeal', upload.fields([
  { name: 'evidence_video', maxCount: 1 },
  { name: 'evidence_screenshots', maxCount: 10 },
  { name: 'evidence_documents', maxCount: 10 }
]), async (req: any, res) => {
  try {
    const orderId = req.params.orderId;
    
    // Debug: Log the request body to see what's being received
    console.log('🔍 DEBUG: Request body:', req.body);
    console.log('🔍 DEBUG: Request body keys:', Object.keys(req.body));
    console.log('🔍 DEBUG: Request files:', req.files);
    console.log('🔍 DEBUG: Order ID from params:', orderId);
    
    // Get user info from request body instead of authenticated user
    const { appellant_address, appellant_type, dispute_type, reason, description } = req.body;
    
    console.log('🔍 DEBUG: Extracted fields:', {
      appellant_address,
      appellant_type,
      dispute_type,
      reason,
      description
    });
    
    // Handle both dispute_type and reason fields (for backward compatibility)
    let finalDisputeType = dispute_type;
    if (!finalDisputeType && reason) {
      // Map reason values to dispute_type values
      switch (reason) {
        case 'payment_not_received':
          finalDisputeType = 'PAYMENT_NOT_RECEIVED';
          break;
        case 'payment_sent_but_not_confirmed':
          finalDisputeType = 'PAYMENT_NOT_SENT';
          break;
        default:
          finalDisputeType = 'OTHER';
      }
    }
    
    console.log('🔍 DEBUG: Final dispute type:', finalDisputeType);
    
    // Handle case where fields might be undefined
    if (!finalDisputeType) {
      console.log('❌ ERROR: dispute_type is missing');
      return res.status(400).json({
        success: false,
        error: 'dispute_type or reason field is missing from request body'
      });
    }
    
    if (!description) {
      console.log('❌ ERROR: description is missing');
      return res.status(400).json({
        success: false,
        error: 'description field is missing from request body'
      });
    }
    
    // Handle video file upload first
    let videoUrl = null;
    if (req.files && req.files.evidence_video && req.files.evidence_video[0]) {
      const videoFile = req.files.evidence_video[0];
      console.log('📹 Processing video file:', {
        originalname: videoFile.originalname,
        mimetype: videoFile.mimetype,
        size: videoFile.size,
        filename: videoFile.filename,
        path: videoFile.path
      });
      
      // File is already saved to disk by multer, just store the filename
      videoUrl = videoFile.filename;
      console.log('📹 Video file saved as:', videoUrl);
    }

    // Create a clean object for validation
    const appealData = {
      dispute_type: finalDisputeType,
      description,
      evidence_video_url: videoUrl,
      evidence_screenshots: req.body.evidence_screenshots || null,
      evidence_documents: req.body.evidence_documents || null
    };
    
    console.log('🔍 DEBUG: Appeal data for validation:', appealData);
    
    const { error, value } = createAppealSchema.validate(appealData);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    console.log('🔄 CREATE APPEAL: Starting appeal creation');
    console.log('👤 CREATE APPEAL: Appellant:', appellant_address);
    console.log('📝 CREATE APPEAL: Order ID:', orderId);

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if appellant is buyer or seller
    const isBuyer = order.buyer_address.toLowerCase() === appellant_address.toLowerCase();
    const isSeller = order.seller_address.toLowerCase() === appellant_address.toLowerCase();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Only buyer or seller can file an appeal'
      });
    }

    // Check if order is in LOCKED state or already disputed
    if (!['LOCKED', 'UNDER_DISPUTE'].includes(order.state)) {
      return res.status(400).json({
        success: false,
        error: 'Order must be in LOCKED or UNDER_DISPUTE state to file appeal'
      });
    }

    // Appeal window check removed - users can file appeals anytime

    // Create dispute if it doesn't exist
    let disputeResult = await pool.query(
      'SELECT * FROM disputes WHERE order_id = $1',
      [orderId]
    );

    let disputeId;
    if (disputeResult.rows.length === 0) {
      const newDisputeResult = await pool.query(
        `INSERT INTO disputes (order_id, dispute_type, created_by, status)
         VALUES ($1, $2, $3, 'PENDING')
         RETURNING *`,
        [orderId, value.dispute_type, appellant_address]
      );
      disputeId = newDisputeResult.rows[0].id;

      // Update order state
      await pool.query(
        'UPDATE orders SET state = $1, dispute_id = $2 WHERE id = $3',
        ['UNDER_DISPUTE', disputeId, orderId]
      );

      // Create admin notification
      await pool.query(
        `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority)
         VALUES ($1, $2, 'NEW_DISPUTE', 'New Dispute Filed', 'A new dispute has been filed for order #' || $2, 'HIGH')`,
        [disputeId, orderId]
      );
    } else {
      disputeId = disputeResult.rows[0].id;
    }

    // Check if appellant has already filed an appeal
    const existingAppeal = await pool.query(
      'SELECT * FROM appeals WHERE dispute_id = $1 AND appellant_address = $2',
      [disputeId, appellant_address]
    );

    if (existingAppeal.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already filed an appeal for this dispute'
      });
    }


    // Create appeal
    const appealResult = await pool.query(
      `INSERT INTO appeals (dispute_id, order_id, appellant_address, appellant_type, description, evidence_video_url, evidence_screenshots, evidence_documents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        disputeId,
        orderId,
        appellant_address,
        appellant_type || (isBuyer ? 'BUYER' : 'SELLER'),
        value.description,
        videoUrl,
        value.evidence_screenshots || null,
        value.evidence_documents || null
      ]
    );

    // Log timeline event
    await pool.query(
      `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by, metadata)
       VALUES ($1, $2, 'APPEAL_FILED', $3, $4, $5)`,
      [
        disputeId,
        orderId,
        `${isBuyer ? 'Buyer' : 'Seller'} filed an appeal`,
        appellant_address,
        JSON.stringify({ appeal_id: appealResult.rows[0].id, dispute_type: value.dispute_type })
      ]
    );

    // Create admin notification for appeal
    await pool.query(
      `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority)
       VALUES ($1, $2, 'NEW_APPEAL', 'New Appeal Filed', $3, 'URGENT')`,
      [
        disputeId,
        orderId,
        `${isBuyer ? 'Buyer' : 'Seller'} filed an appeal for dispute #${disputeId}`
      ]
    );

    console.log('✅ Appeal created successfully:', {
      appealId: appealResult.rows[0].id,
      disputeId,
      orderId: parseInt(orderId),
      appellantType: isBuyer ? 'BUYER' : 'SELLER',
      videoUrl
    });

    res.json({
      success: true,
      data: {
        appealId: appealResult.rows[0].id,
        disputeId,
        orderId: parseInt(orderId),
        appellantType: isBuyer ? 'BUYER' : 'SELLER',
        message: 'Appeal filed successfully. Admin will review within 48 hours.'
      }
    });

  } catch (error) {
    console.error('Create appeal error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get dispute status
router.get('/:orderId/status', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.orderId;
    const user = req.user;

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if user is buyer or seller
    const isBuyer = order.buyer_address.toLowerCase() === user.address.toLowerCase();
    const isSeller = order.seller_address.toLowerCase() === user.address.toLowerCase();

    if (!isBuyer && !isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get payment confirmations
    const confirmationResult = await pool.query(
      'SELECT * FROM payment_confirmations WHERE order_id = $1',
      [orderId]
    );

    // Get dispute details if exists
    const disputeResult = await pool.query(
      'SELECT * FROM disputes WHERE order_id = $1',
      [orderId]
    );

    // Get appeals if dispute exists
    let appeals = [];
    if (disputeResult.rows.length > 0) {
      const appealsResult = await pool.query(
        'SELECT * FROM appeals WHERE dispute_id = $1 ORDER BY created_at DESC',
        [disputeResult.rows[0].id]
      );
      appeals = appealsResult.rows;
    }

    // Calculate time remaining
    const lockTime = new Date(order.lock_expires_at).getTime();
    const now = Date.now();
    const timeRemaining = Math.max(0, lockTime - now);
    const appealDeadline = lockTime + (48 * 60 * 60 * 1000);
    const appealTimeRemaining = Math.max(0, appealDeadline - now);

    res.json({
      success: true,
      data: {
        orderId: parseInt(orderId),
        state: order.state,
        timeRemaining,
        appealTimeRemaining,
        confirmations: confirmationResult.rows[0] || null,
        dispute: disputeResult.rows[0] || null,
        appeals,
        userRole: isBuyer ? 'BUYER' : 'SELLER',
        canAppeal: order.state === 'UNDER_DISPUTE' && appealTimeRemaining > 0,
        canConfirm: order.state === 'LOCKED' && timeRemaining > 0,
        blockchain_trade_id: order.blockchain_trade_id
      }
    });

  } catch (error) {
    console.error('Get dispute status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
