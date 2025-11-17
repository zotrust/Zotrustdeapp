import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth';
import pool from '../config/database';
import { ContractService } from '../services/contractService';
import { APIResponse, CreateOrderRequest, AcceptOrderRequest } from '../types';
import { scheduleOrderTimeout } from '../workers/orderWorker';

const router = express.Router();
const contractService = new ContractService();

// Constants
const ACCEPT_TIMEOUT_MINUTES = 5; // Order acceptance timeout in minutes

// Validation schemasblock
const createOrderSchema = Joi.object({
  ad_id: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  selected_agent_id: Joi.string().optional(),
  timezone: Joi.string().required() // User's timezone for display purposes only
});

const acceptOrderSchema = Joi.object({});

// Create order
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    console.log('🔄 CREATE ORDER: Starting order creation process');
    console.log('📝 CREATE ORDER: Request body:', req.body);
    console.log('👤 CREATE ORDER: User address:', req.user?.address);
    
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      console.log('❌ CREATE ORDER: Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const user = req.user;
    const orderData: CreateOrderRequest = value;
    console.log('✅ CREATE ORDER: Validation passed, order data:', orderData);

    // Get ad details
    console.log('🔍 CREATE ORDER: Fetching ad details for ad_id:', orderData.ad_id);
    const adResult = await pool.query(
      `SELECT a.*, u.address as owner_address, ag.branch_name, ag.mobile as agent_mobile, ag.address as agent_address
       FROM ads a
       JOIN users u ON a.owner_address = u.address
       LEFT JOIN agents ag ON a.owner_selected_agent_id = ag.id
       WHERE a.id = $1 AND a.active = true`,
      [orderData.ad_id]
    );

    console.log('📊 CREATE ORDER: Ad query result rows:', adResult.rows.length);
    if (adResult.rows.length === 0) {
      console.log('❌ CREATE ORDER: Ad not found or inactive');
      return res.status(404).json({
        success: false,
        error: 'Ad not found or inactive'
      });
    }

    const ad = adResult.rows[0];
    console.log('✅ CREATE ORDER: Ad found:', {
      id: ad.id,
      type: ad.type,
      owner_address: ad.owner_address,
      min_amount: ad.min_amount,
      max_amount: ad.max_amount
    });

    // Get selected agent information if provided
    let selectedAgent = null;
    if (orderData.selected_agent_id) {
      console.log('🔍 CREATE ORDER: Fetching selected agent details for agent_id:', orderData.selected_agent_id);
      const agentResult = await pool.query(
        'SELECT * FROM agents WHERE id = $1',
        [orderData.selected_agent_id]
      );
      
      if (agentResult.rows.length > 0) {
        selectedAgent = agentResult.rows[0];
        console.log('✅ CREATE ORDER: Selected agent found:', {
          id: selectedAgent.id,
          branch_name: selectedAgent.branch_name,
          mobile: selectedAgent.mobile,
          address: selectedAgent.address
        });
      } else {
        console.log('⚠️ CREATE ORDER: Selected agent not found, using default agent');
      }
    }

    // Check if user is trying to order from their own ad
    if (ad.owner_address.toLowerCase() === user.address.toLowerCase()) {
      console.log('❌ CREATE ORDER: User trying to order from own ad');
      return res.status(400).json({
        success: false,
        error: 'Cannot create order for your own ad'
      });
    }

    // Validate amount range
    console.log('💰 CREATE ORDER: Validating amount:', {
      requested: orderData.amount,
      min: ad.min_amount,
      max: ad.max_amount
    });
    if (orderData.amount < ad.min_amount || orderData.amount > ad.max_amount) {
      console.log('❌ CREATE ORDER: Amount out of range');
      return res.status(400).json({
        success: false,
        error: `Amount must be between ${ad.min_amount} and ${ad.max_amount}`
      });
    }

    // Check trading enabled status (time restrictions removed)
    console.log('⏰ CREATE ORDER: Checking trading enabled status');
    const tradingHoursResult = await pool.query(
      `SELECT key, value FROM app_settings 
       WHERE key IN ('trading_buy_enabled', 'trading_sell_enabled')`
    );

    const tradingSettings: any = {
      buyEnabled: true,
      sellEnabled: true
    };

    tradingHoursResult.rows.forEach((row: any) => {
      if (row.key === 'trading_buy_enabled') {
        tradingSettings.buyEnabled = row.value === 'true';
      } else if (row.key === 'trading_sell_enabled') {
        tradingSettings.sellEnabled = row.value === 'true';
      }
    });

    // Check if trading type is enabled
    if (ad.type === 'BUY' && !tradingSettings.sellEnabled) {
      console.log('❌ CREATE ORDER: SELL trading is disabled');
      return res.status(400).json({
        success: false,
        error: 'SELL trading is currently disabled. Please try again later.'
      });
    }
    if (ad.type === 'SELL' && !tradingSettings.buyEnabled) {
      console.log('❌ CREATE ORDER: BUY trading is disabled');
      return res.status(400).json({
        success: false,
        error: 'BUY trading is currently disabled. Please try again later.'
      });
    }

    // Determine buyer and seller based on ad type
    const buyerAddress = ad.type === 'BUY' ? ad.owner_address : user.address;
    const sellerAddress = ad.type === 'BUY' ? user.address : ad.owner_address;
    console.log('👥 CREATE ORDER: Role assignment:', {
      ad_type: ad.type,
      ad_owner: ad.owner_address,
      order_creator: user.address,
      buyer_address: buyerAddress,
      seller_address: sellerAddress,
      note: ad.type === 'BUY' ? 'Ad owner wants to BUY, order creator wants to SELL' : 'Ad owner wants to SELL, order creator wants to BUY'
    });

    // Create order in database with UTC timestamps
    console.log('💾 CREATE ORDER: Inserting order into database');
    
    // Use selected agent if available, otherwise use default agent from ad
    const agentBranch = selectedAgent ? selectedAgent.branch_name : ad.branch_name;
    const agentMobile = selectedAgent ? selectedAgent.mobile : ad.agent_mobile;
    const agentAddress = selectedAgent ? selectedAgent.address : ad.agent_address;
    
    console.log('👤 CREATE ORDER: Using agent info:', {
      selected_agent: selectedAgent ? selectedAgent.id : 'default',
      branch: agentBranch,
      mobile: agentMobile,
      address: agentAddress
    });
    
    // Let database generate both created_at and start_time using CURRENT_TIMESTAMP
    // This ensures they are identical and in UTC
    const timezone = orderData.timezone || 'Asia/Calcutta';
    
    // We'll generate start_datetime_string after insert using the database timestamp
    const orderResult = await pool.query(
      `INSERT INTO orders (ad_id, buyer_address, seller_address, amount, token, agent_branch, agent_number, agent_address, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orderData.ad_id,
        buyerAddress,
        sellerAddress,
        orderData.amount,
        ad.token,
        agentBranch,
        agentMobile,
        agentAddress,
        timezone
      ]
    );

    // Now generate start_datetime_string using the actual start_time from database
    const order = orderResult.rows[0];
    const startDatetimeString = new Date(order.start_time).toLocaleString('en-IN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ` ${timezone.split('/').pop()}`;
    
    // Update the order with the formatted datetime string
    await pool.query(
      `UPDATE orders SET start_datetime_string = $1 WHERE id = $2`,
      [startDatetimeString, order.id]
    );
    
    // Refresh order data to get the updated start_datetime_string
    const updatedOrderResult = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [order.id]
    );
    const finalOrder = updatedOrderResult.rows[0];
    
    // Calculate expiry time: 5 minutes from start_time (both in UTC)
    const startTimeMs = new Date(finalOrder.start_time).getTime();
    const expiresAtMs = startTimeMs + (5 * 60 * 1000); // 5 minutes
    const expiresAt = new Date(expiresAtMs).toISOString();
    const serverTime = new Date().toISOString();
    
    const createdAtMs = new Date(finalOrder.created_at).getTime();
    const startTimeMsCheck = new Date(finalOrder.start_time).getTime();
    const timeDiff = Math.abs(createdAtMs - startTimeMsCheck);
    
    console.log('✅ CREATE ORDER: Order created successfully:', {
      order_id: finalOrder.id,
      state: finalOrder.state,
      created_at: finalOrder.created_at,
      start_time: finalOrder.start_time,
      timezone: finalOrder.timezone,
      start_datetime_string: finalOrder.start_datetime_string,
      expires_at: expiresAt,
      server_time: serverTime,
      verification: {
        created_at_matches_start_time: timeDiff < 1000, // Within 1 second
        time_difference_ms: timeDiff,
        note: timeDiff < 1000 ? '✅ Timestamps match!' : `❌ ${timeDiff}ms difference`
      }
    });

    // Schedule order timeout (5 minutes)
    console.log('⏰ CREATE ORDER: Scheduling order timeout for order:', finalOrder.id);
    await scheduleOrderTimeout(finalOrder.id);

    // Log order creation
    console.log('📝 CREATE ORDER: Logging audit trail');
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.address, 'CREATE_ORDER', 'order', finalOrder.id.toString(), JSON.stringify({ ad_id: orderData.ad_id, amount: orderData.amount, expires_at: expiresAt }), req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: {
        ...finalOrder,
        expires_at: expiresAt,
        server_time: serverTime
      },
      message: 'Order created successfully'
    };

    console.log('🎉 CREATE ORDER: Success response sent');
    res.json(response);
  } catch (error) {
    console.error('💥 CREATE ORDER: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Prepare to accept order - Generate OTP but DON'T update database yet
router.post('/:id/prepare-accept', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    console.log('🔐 PREPARE ACCEPT: Generating OTP for order:', orderId);
    console.log('👤 PREPARE ACCEPT: User address:', user?.address);
    
    // Get order details
    const orderResult = await pool.query(
      `SELECT o.*, a.owner_address as ad_owner_address, a.type as ad_type
       FROM orders o
       JOIN ads a ON o.ad_id = a.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if user is the ad owner
    if (order.ad_owner_address.toLowerCase() !== user.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Only the ad owner can accept this order'
      });
    }

    // Check if order is in CREATED state
    if (order.state !== 'CREATED') {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be accepted in current state'
      });
    }

    // Check if order has expired
    const ACCEPT_TIMEOUT_MINUTES = 5;
    const startTime = new Date(order.start_time).getTime();
    const now = Date.now();
    const elapsed = now - startTime;
    const timeoutMs = ACCEPT_TIMEOUT_MINUTES * 60 * 1000;
    
    if (elapsed > timeoutMs) {
      return res.status(400).json({
        success: false,
        error: `Order acceptance window has expired.`
      });
    }

    // Generate OTP and hash (NO order state update)
    const crypto = require('crypto');
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = '0x' + crypto.createHash('sha256').update(otp).digest('hex');
    
    console.log('✅ PREPARE ACCEPT: OTP generated:', otp);
    console.log('🔐 PREPARE ACCEPT: OTP Hash:', otpHash);
    
    // Save OTP to otp_logs table for later verification
    const otpExpiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours
    await pool.query(
      `INSERT INTO otp_logs (order_id, user_address, otp_hash, expires_at, used)
       VALUES ($1, $2, $3, $4, false)`,
      [orderId, user.address, otpHash, otpExpiresAt]
    );
    console.log('💾 PREPARE ACCEPT: OTP saved to otp_logs table');

    const response: APIResponse = {
      success: true,
      data: {
        orderId: parseInt(orderId),
        otp: otp,
        otpHash: otpHash,
        
        blockchain: {
          contractAddress: process.env.CONTRACT_ADDRESS || '0x02ADD84281025BeeB807f5b94Ea947599146ca00',
          tradeId: parseInt(orderId),
          network: 'BSC Mainnet',
          chainId: 56
        },
        
        message: 'OTP generated. Lock funds on blockchain before finalizing.',
        note: 'Save the OTP! You will need it to release funds after payment.'
      }
    };

    console.log('🎉 PREPARE ACCEPT: OTP sent to user');
    res.json(response);
  } catch (error) {
    console.error('💥 PREPARE ACCEPT: Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Accept order - Finalize after blockchain lock (requires txHash)
router.post('/:id/accept', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    const { txHash, otpHash, blockchainTradeId, createTradeTxHash } = req.body;
    
    console.log('💾 ACCEPT ORDER (FINALIZE): Starting database update');
    console.log('👤 User:', user?.address);
    console.log('📝 Order ID:', orderId);
    console.log('📡 Lock Funds TX Hash:', txHash);
    console.log('📡 Create Trade TX Hash:', createTradeTxHash);
    console.log('🔗 Blockchain Trade ID:', blockchainTradeId);
    console.log('🔐 OTP Hash:', otpHash);
    
    // Validate required fields
    if (!txHash || !otpHash || !blockchainTradeId) {
      console.log('❌ ACCEPT ORDER: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Transaction hash, OTP hash, and blockchain trade ID are required'
      });
    }
    
    // Verify txHash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction hash format'
      });
    }

    // Get order details with ad owner information
    console.log('🔍 ACCEPT ORDER: Fetching order details for order:', orderId);
    const orderResult = await pool.query(
      `SELECT o.*, a.owner_address as ad_owner_address, a.type as ad_type
       FROM orders o
       JOIN ads a ON o.ad_id = a.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log('❌ ACCEPT ORDER: Order not found');
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if user is the ad owner (the one who should accept the order)
    if (order.ad_owner_address.toLowerCase() !== user.address.toLowerCase()) {
      console.log('❌ ACCEPT ORDER: User is not the ad owner', {
        ad_owner: order.ad_owner_address,
        current_user: user.address
      });
      return res.status(403).json({
        success: false,
        error: 'Only the ad owner can accept this order'
      });
    }

    // Check if order is in CREATED state
    if (order.state !== 'CREATED') {
      console.log('❌ ACCEPT ORDER: Order not in CREATED state, current state:', order.state);
      return res.status(400).json({
        success: false,
        error: 'Order cannot be accepted in current state'
      });
    }

    // Check if order has expired (5 minutes from start_time in UTC)
    const ACCEPT_TIMEOUT_MINUTES = 5;
    const startTime = new Date(order.start_time).getTime();
    const now = Date.now();
    const elapsed = now - startTime;
    const timeoutMs = ACCEPT_TIMEOUT_MINUTES * 60 * 1000;
    
    if (elapsed > timeoutMs) {
      console.log('❌ ACCEPT ORDER: Order has expired');
      return res.status(400).json({
        success: false,
        error: `Order acceptance window has expired. Orders must be accepted within ${ACCEPT_TIMEOUT_MINUTES} minutes.`
      });
    }

    // OTP was already generated in /prepare-accept endpoint
    // txHash comes from frontend after successful blockchain lock
    console.log('✅ ACCEPT ORDER: Blockchain lock confirmed (txHash provided)');
    console.log('💾 ACCEPT ORDER: Proceeding with database update');
    
    // Calculate lock expiry time (2 hours from now in UTC)
    const lockExpiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000));

    // Start database transaction - only after successful blockchain lock
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      console.log('💾 ACCEPT ORDER: Updating order state to ACCEPTED (LOCKED on blockchain)');
      const acceptedAt = new Date(); // Current UTC time
      await client.query(
        `UPDATE orders SET 
          state = 'ACCEPTED', 
          accepted_at = $1, 
          lock_expires_at = $2,
          otp_hash = $3,
          tx_hash = $4,
          blockchain_trade_id = $5,
          create_trade_tx_hash = $6
         WHERE id = $7`,
        [acceptedAt, lockExpiresAt, otpHash, txHash, blockchainTradeId, createTradeTxHash, orderId]
      );

      // Generate transaction record
      console.log('💳 ACCEPT ORDER: Creating transaction record');
      const transactionNumber = `TXN-${Date.now()}-${orderId}`;
      
      const adResult = await client.query(
        'SELECT type, token, sell_quantity, buy_quantity FROM ads WHERE id = $1',
        [order.ad_id]
      );
      
      if (adResult.rows.length === 0) {
        throw new Error('Ad not found for transaction creation');
      }
      
      const ad = adResult.rows[0];
      const transactionType = ad.type;
      
      await client.query(
        `INSERT INTO transactions (
          transaction_number, order_id, buyer_address, seller_address, 
          amount, token, transaction_type, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
        [
          transactionNumber,
          orderId,
          order.buyer_address,
          order.seller_address,
          order.amount,
          ad.token,
          transactionType
        ]
      );
      
      console.log('✅ ACCEPT ORDER: Transaction created:', transactionNumber);
      
      // Update ad quantity: reduce sell_quantity for SELL ads, reduce buy_quantity for BUY ads
      if (ad.type === 'SELL' && ad.sell_quantity !== null) {
        const newQuantity = Math.max(0, parseFloat(ad.sell_quantity) - parseFloat(order.amount));
        await client.query(
          `UPDATE ads SET sell_quantity = $1, updated_at = NOW() WHERE id = $2`,
          [newQuantity.toString(), order.ad_id]
        );
        console.log(`📉 ACCEPT ORDER: Reduced sell_quantity from ${ad.sell_quantity} to ${newQuantity} for ad ${order.ad_id}`);
        
        // If quantity reaches 0, deactivate the ad
        if (newQuantity <= 0) {
          await client.query(
            `UPDATE ads SET active = false, updated_at = NOW() WHERE id = $1`,
            [order.ad_id]
          );
          console.log(`🚫 ACCEPT ORDER: Deactivated ad ${order.ad_id} (quantity exhausted)`);
        }
      } else if (ad.type === 'BUY' && ad.buy_quantity !== null) {
        const newQuantity = Math.max(0, parseFloat(ad.buy_quantity) - parseFloat(order.amount));
        await client.query(
          `UPDATE ads SET buy_quantity = $1, updated_at = NOW() WHERE id = $2`,
          [newQuantity.toString(), order.ad_id]
        );
        console.log(`📉 ACCEPT ORDER: Reduced buy_quantity from ${ad.buy_quantity} to ${newQuantity} for ad ${order.ad_id}`);
        
        // If quantity reaches 0, deactivate the ad
        if (newQuantity <= 0) {
          await client.query(
            `UPDATE ads SET active = false, updated_at = NOW() WHERE id = $1`,
            [order.ad_id]
          );
          console.log(`🚫 ACCEPT ORDER: Deactivated ad ${order.ad_id} (quantity exhausted)`);
        }
      }
      
      // OTP was already saved in /prepare-accept endpoint
      // Just commit the transaction
      await client.query('COMMIT');
      console.log('✅ ACCEPT ORDER: Database transaction committed successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ ACCEPT ORDER: Database transaction rolled back due to error:', error);
      throw error;
    } finally {
      client.release();
    }

    // Log order acceptance
    console.log('📝 ACCEPT ORDER: Logging audit trail');
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.address, 'ACCEPT_ORDER', 'order', orderId, req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: {
        orderId: parseInt(orderId),
        lockExpiresAt,
        lockDurationHours: 2,
        txHash: txHash,
        message: 'Order accepted successfully! Funds are locked on blockchain.',
        note: 'Use your saved OTP to release funds after receiving payment.'
      }
    };

    console.log('🎉 ACCEPT ORDER (FINALIZE): Order accepted in database');
    console.log('📡 ACCEPT ORDER (FINALIZE): TX Hash saved:', txHash);
    res.json(response);
  } catch (error) {
    console.error('💥 ACCEPT ORDER: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Simple accept - just update database, no blockchain (NEW FLOW)
router.post('/:id/accept-simple', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    console.log('🔄 ACCEPT SIMPLE: Starting simple accept for order:', orderId);
    console.log('👤 ACCEPT SIMPLE: User address:', user?.address);

    // Fetch order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log('❌ ACCEPT SIMPLE: Order not found');
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];
    console.log('✅ ACCEPT SIMPLE: Order found, current state:', order.state);

    // Check if user is ad owner (only ad owner can accept)
    const adResult = await pool.query(
      'SELECT owner_address FROM ads WHERE id = $1',
      [order.ad_id]
    );

    if (adResult.rows.length === 0) {
      console.log('❌ ACCEPT SIMPLE: Ad not found');
      return res.status(404).json({
        success: false,
        error: 'Ad not found'
      });
    }

    const ad = adResult.rows[0];
    if (ad.owner_address.toLowerCase() !== user.address.toLowerCase()) {
      console.log('❌ ACCEPT SIMPLE: User is not ad owner');
      return res.status(403).json({
        success: false,
        error: 'Only ad owner can accept orders'
      });
    }

    // Check order state
    if (order.state !== 'CREATED') {
      console.log('❌ ACCEPT SIMPLE: Order not in CREATED state');
      return res.status(400).json({
        success: false,
        error: 'Order can only be accepted when in CREATED state'
      });
    }

    // Check if expired
    const startTime = new Date(order.start_time).getTime();
    const now = Date.now();
    const elapsed = now - startTime;
    const timeoutMs = ACCEPT_TIMEOUT_MINUTES * 60 * 1000;
    
    if (elapsed > timeoutMs) {
      console.log('❌ ACCEPT SIMPLE: Order has expired');
      return res.status(400).json({
        success: false,
        error: `Order acceptance window has expired. Orders must be accepted within ${ACCEPT_TIMEOUT_MINUTES} minutes.`
      });
    }

    // Update order state to ACCEPTED
    console.log('💾 ACCEPT SIMPLE: Updating order state to ACCEPTED');
    const acceptedAt = new Date();
    await pool.query(
      `UPDATE orders SET 
        state = 'ACCEPTED', 
        accepted_at = $1
       WHERE id = $2`,
      [acceptedAt, orderId]
    );

    // Log acceptance
    console.log('📝 ACCEPT SIMPLE: Logging audit trail');
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [user.address, 'ACCEPT_ORDER_SIMPLE', 'order', orderId, req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: {
        orderId: parseInt(orderId),
        state: 'ACCEPTED',
        acceptedAt: acceptedAt,
        message: 'Order accepted! Seller needs to lock funds on blockchain.'
      }
    };

    console.log('🎉 ACCEPT SIMPLE: Order accepted successfully');
    res.json(response);
  } catch (error) {
    console.error('💥 ACCEPT SIMPLE: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Prepare lock funds - Generate OTP for seller (NEW FLOW)
router.post('/:id/prepare-lock', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    console.log('🔐 PREPARE LOCK: Generating OTP for order:', orderId);
    console.log('👤 PREPARE LOCK: User address:', user?.address);

    // Fetch order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log('❌ PREPARE LOCK: Order not found');
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];
    console.log('✅ PREPARE LOCK: Order found, current state:', order.state);

    // Check if user is seller
    if (order.seller_address.toLowerCase() !== user.address.toLowerCase()) {
      console.log('❌ PREPARE LOCK: User is not seller');
      return res.status(403).json({
        success: false,
        error: 'Only seller can lock funds'
      });
    }

    // Check order state
    if (order.state !== 'ACCEPTED') {
      console.log('❌ PREPARE LOCK: Order not in ACCEPTED state');
      return res.status(400).json({
        success: false,
        error: 'Order must be in ACCEPTED state to lock funds'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = '0x' + crypto.createHash('sha256').update(otp).digest('hex');
    
    console.log('✅ PREPARE LOCK: OTP generated:', otp);
    console.log('🔐 PREPARE LOCK: OTP Hash:', otpHash);

    // Save OTP to otp_logs table
    const otpExpiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours
    await pool.query(
      `INSERT INTO otp_logs (order_id, user_address, otp_hash, expires_at, used)
       VALUES ($1, $2, $3, $4, false)`,
      [orderId, user.address, otpHash, otpExpiresAt]
    );
    
    console.log('💾 PREPARE LOCK: OTP saved to otp_logs table');

    // Get blockchain details
    const tradeId = Date.now(); // Temporary trade ID, will be replaced by actual blockchain trade ID
    
    const response: APIResponse = {
      success: true,
      data: {
        otp: otp,
        otpHash: otpHash,
        blockchain: {
          tradeId: tradeId,
          contractAddress: process.env.CONTRACT_ADDRESS || '0x02ADD84281025BeeB807f5b94Ea947599146ca00',
          network: 'BSC Mainnet',
          chainId: 56
        }
      }
    };

    console.log('🎉 PREPARE LOCK: OTP sent to seller');
    res.json(response);
  } catch (error) {
    console.error('💥 PREPARE LOCK: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Lock funds on blockchain (NEW FLOW - called by seller)
router.post('/:id/lock-funds', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    const { txHash, otpHash, blockchainTradeId, createTradeTxHash } = req.body;
    
    console.log('🔄 LOCK FUNDS: Starting lock funds process for order:', orderId);
    console.log('👤 LOCK FUNDS: User address:', user?.address);
    console.log('📡 LOCK FUNDS: TX Hash:', txHash);
    console.log('🔐 LOCK FUNDS: OTP Hash:', otpHash);
    console.log('🆔 LOCK FUNDS: Blockchain Trade ID (raw):', blockchainTradeId);
    console.log('🆔 LOCK FUNDS: Blockchain Trade ID (type):', typeof blockchainTradeId);
    
    // Validate required fields
    if (!txHash || !otpHash || !blockchainTradeId) {
      console.log('❌ LOCK FUNDS: Missing required fields', {
        txHash: !!txHash,
        otpHash: !!otpHash,
        blockchainTradeId: !!blockchainTradeId
      });
      return res.status(400).json({
        success: false,
        error: 'Transaction hash, OTP hash, and blockchain trade ID are required'
      });
    }
    
    // Validate and convert blockchainTradeId to integer
    const tradeIdNumber = parseInt(String(blockchainTradeId), 10);
    if (isNaN(tradeIdNumber) || tradeIdNumber <= 0) {
      console.log('❌ LOCK FUNDS: Invalid blockchain trade ID', {
        received: blockchainTradeId,
        parsed: tradeIdNumber
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid blockchain trade ID. Must be a positive integer.'
      });
    }
    
    console.log('✅ LOCK FUNDS: Validated blockchain trade ID:', tradeIdNumber);

    // Fetch order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log('❌ LOCK FUNDS: Order not found');
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];
    console.log('✅ LOCK FUNDS: Order found, current state:', order.state);

    // Check if user is seller
    if (order.seller_address.toLowerCase() !== user.address.toLowerCase()) {
      console.log('❌ LOCK FUNDS: User is not seller');
      return res.status(403).json({
        success: false,
        error: 'Only seller can lock funds'
      });
    }

    // Check order state
    if (order.state !== 'ACCEPTED') {
      console.log('❌ LOCK FUNDS: Order not in ACCEPTED state');
      return res.status(400).json({
        success: false,
        error: 'Order must be in ACCEPTED state to lock funds'
      });
    }

    // Calculate lock expiry time (2 hours from now in UTC)
    const lockExpiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000));
    const otpExpiresAt = new Date(Date.now() + (2 * 60 * 60 * 1000));

    // Update order with blockchain details
    console.log('💾 LOCK FUNDS: Updating order with blockchain details');
    console.log('💾 LOCK FUNDS: Values to save:', {
      lockExpiresAt,
      otpHash,
      txHash,
      blockchain_trade_id: tradeIdNumber,
      create_trade_tx_hash: createTradeTxHash,
      orderId
    });
    
    const updateResult = await pool.query(
      `UPDATE orders SET 
        state = 'LOCKED', 
        lock_expires_at = $1,
        otp_hash = $2,
        tx_hash = $3,
        blockchain_trade_id = $4,
        create_trade_tx_hash = $5
       WHERE id = $6
       RETURNING blockchain_trade_id`,
      [lockExpiresAt, otpHash, txHash, tradeIdNumber, createTradeTxHash, orderId]
    );
    
    console.log('✅ LOCK FUNDS: Order updated successfully');
    console.log('✅ LOCK FUNDS: Saved blockchain_trade_id:', updateResult.rows[0]?.blockchain_trade_id);

    // Create transaction record
    console.log('💳 LOCK FUNDS: Creating transaction record');
    const transactionNumber = `TXN-${Date.now()}-${orderId}`;
    
    const adResult = await pool.query(
      'SELECT type, token, sell_quantity, buy_quantity FROM ads WHERE id = $1',
      [order.ad_id]
    );
    
    if (adResult.rows.length === 0) {
      throw new Error('Ad not found for transaction creation');
    }
    
    const ad = adResult.rows[0];
    const transactionType = ad.type;
    
    await pool.query(
      `INSERT INTO transactions (
        transaction_number, order_id, buyer_address, seller_address, 
        amount, token, transaction_type, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
      [
        transactionNumber,
        orderId,
        order.buyer_address,
        order.seller_address,
        order.amount,
        ad.token,
        transactionType
      ]
    );
    
    console.log('✅ LOCK FUNDS: Transaction created:', transactionNumber);
    
    // Update ad quantity: reduce sell_quantity for SELL ads, reduce buy_quantity for BUY ads
    if (ad.type === 'SELL' && ad.sell_quantity !== null) {
      const newQuantity = Math.max(0, parseFloat(ad.sell_quantity) - parseFloat(order.amount));
      await pool.query(
        `UPDATE ads SET sell_quantity = $1, updated_at = NOW() WHERE id = $2`,
        [newQuantity.toString(), order.ad_id]
      );
      console.log(`📉 LOCK FUNDS: Reduced sell_quantity from ${ad.sell_quantity} to ${newQuantity} for ad ${order.ad_id}`);
      
      // If quantity reaches 0, deactivate the ad
      if (newQuantity <= 0) {
        await pool.query(
          `UPDATE ads SET active = false, updated_at = NOW() WHERE id = $1`,
          [order.ad_id]
        );
        console.log(`🚫 LOCK FUNDS: Deactivated ad ${order.ad_id} (quantity exhausted)`);
      }
    } else if (ad.type === 'BUY' && ad.buy_quantity !== null) {
      const newQuantity = Math.max(0, parseFloat(ad.buy_quantity) - parseFloat(order.amount));
      await pool.query(
        `UPDATE ads SET buy_quantity = $1, updated_at = NOW() WHERE id = $2`,
        [newQuantity.toString(), order.ad_id]
      );
      console.log(`📉 LOCK FUNDS: Reduced buy_quantity from ${ad.buy_quantity} to ${newQuantity} for ad ${order.ad_id}`);
      
      // If quantity reaches 0, deactivate the ad
      if (newQuantity <= 0) {
        await pool.query(
          `UPDATE ads SET active = false, updated_at = NOW() WHERE id = $1`,
          [order.ad_id]
        );
        console.log(`🚫 LOCK FUNDS: Deactivated ad ${order.ad_id} (quantity exhausted)`);
      }
    }

    // Log lock funds
    console.log('📝 LOCK FUNDS: Logging audit trail');
    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.address, 'LOCK_FUNDS', 'order', orderId, JSON.stringify({ txHash, blockchainTradeId: tradeIdNumber }), req.ip]
    );

    const response: APIResponse = {
      success: true,
      data: {
        orderId: parseInt(orderId),
        state: 'LOCKED',
        lockExpiresAt,
        lockDurationHours: 2,
        txHash: txHash,
        blockchainTradeId: tradeIdNumber,
        message: 'Funds locked successfully on blockchain!'
      }
    };

    console.log('🎉 LOCK FUNDS: Funds locked successfully');
    res.json(response);
  } catch (error) {
    console.error('💥 LOCK FUNDS: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Verify payment
router.post('/:id/verify-payment', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    console.log('🔄 VERIFY PAYMENT: Starting payment verification for order:', orderId);
    console.log('👤 VERIFY PAYMENT: User address:', user?.address);

    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log('❌ VERIFY PAYMENT: Order not found');
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];
    console.log('✅ VERIFY PAYMENT: Order found');

    if (order.buyer_address.toLowerCase() !== user.address.toLowerCase() && 
        order.seller_address.toLowerCase() !== user.address.toLowerCase()) {
      console.log('❌ VERIFY PAYMENT: User is neither buyer nor seller');
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (order.state !== 'ACCEPTED') {
      console.log('❌ VERIFY PAYMENT: Order not in ACCEPTED state');
      return res.status(400).json({
        success: false,
        error: 'Order not in acceptable state for payment verification'
      });
    }

    try {
      console.log('⛓️ VERIFY PAYMENT: Releasing funds on blockchain');
      const txHash = await contractService.releaseFundsOnChain(parseInt(orderId));
      console.log('✅ VERIFY PAYMENT: Funds released with txHash:', txHash);
      
      await pool.query(
        'UPDATE orders SET state = $1, tx_hash = $2 WHERE id = $3',
        ['RELEASED', txHash, orderId]
      );

      await pool.query(
        'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.address, 'VERIFY_PAYMENT', 'order', orderId, JSON.stringify({ txHash }), req.ip]
      );

      const response: APIResponse = {
        success: true,
        data: {
          orderId: parseInt(orderId),
          txHash,
          state: 'RELEASED'
        },
        message: 'Payment verified and funds released successfully'
      };

      console.log('🎉 VERIFY PAYMENT: Success response sent');
      res.json(response);
    } catch (contractError) {
      console.error('💥 VERIFY PAYMENT: Contract release error:', contractError);
      res.status(500).json({
        success: false,
        error: 'Failed to release funds on blockchain'
      });
    }
  } catch (error) {
    console.error('💥 VERIFY PAYMENT: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cancel order
router.post('/:id/cancel', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    const { reason } = req.body;
    console.log('🔄 CANCEL ORDER: Starting cancel process');

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

    if (order.buyer_address.toLowerCase() !== user.address.toLowerCase() && 
        order.seller_address.toLowerCase() !== user.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (!['CREATED', 'ACCEPTED'].includes(order.state)) {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled in current state'
      });
    }

    await pool.query(
      'UPDATE orders SET state = $1 WHERE id = $2',
      ['CANCELLED', orderId]
    );

    await pool.query(
      'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.address, 'CANCEL_ORDER', 'order', orderId, JSON.stringify({ reason }), req.ip]
    );

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('💥 CANCEL ORDER: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's orders
router.get('/my-orders', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    const { state, limit = 50, offset = 0 } = req.query;
    console.log('🔄 GET MY ORDERS: Fetching orders');

    let query = `
      SELECT o.*, 
             a.type as ad_type, 
             a.token, 
             a.price_inr, 
             a.owner_address as ad_owner_address,
             buyer_user.name as buyer_name,
             seller_user.name as seller_name,
             CASE 
               WHEN o.buyer_address = $1 THEN 'buyer'
               ELSE 'seller'
             END as user_role
      FROM orders o
      JOIN ads a ON o.ad_id = a.id
      LEFT JOIN users buyer_user ON o.buyer_address = buyer_user.address
      LEFT JOIN users seller_user ON o.seller_address = seller_user.address
      WHERE (o.buyer_address = $1 OR o.seller_address = $1)
    `;
    
    const queryParams: any[] = [user.address];
    let paramIndex = 2;

    if (state) {
      query += ` AND o.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);
    console.log('📊 GET MY ORDERS: Found orders:', result.rows.length);

    // Add expiry calculation (all times in UTC)
    const serverTime = new Date().toISOString();
    const serverTimeMs = Date.now();
    
    const ordersWithExpiry = result.rows.map(order => {
      const startTimeMs = new Date(order.start_time).getTime();
      const expiresAtMs = startTimeMs + (5 * 60 * 1000);
      const expiresAt = new Date(expiresAtMs).toISOString();
      const timeRemainingMs = expiresAtMs - serverTimeMs;
      const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
      const isExpired = timeRemainingMs <= 0;
      
      return {
        ...order,
        expires_at: expiresAt,
        expires_at_ms: expiresAtMs,
        time_remaining_seconds: timeRemainingSeconds,
        is_expired: isExpired
      };
    });

    const response: APIResponse = {
      success: true,
      data: ordersWithExpiry,
      meta: {
        server_time: serverTime,
        server_time_ms: serverTimeMs,
        accept_timeout_minutes: 5
      }
    };

    res.json(response);
  } catch (error) {
    console.error('💥 GET MY ORDERS: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get order requests
router.get('/requests', authenticateToken, async (req: any, res) => {
  try {
    const user = req.user;
    console.log('🔄 GET ORDER REQUESTS: Fetching order requests');

    const result = await pool.query(
      `SELECT o.*, 
              a.type as ad_type, 
              a.token, 
              a.price_inr, 
              u.name as buyer_name
       FROM orders o
       JOIN ads a ON o.ad_id = a.id
       LEFT JOIN users u ON o.buyer_address = u.address
       WHERE o.seller_address = $1 AND o.state = 'CREATED'
       ORDER BY o.created_at DESC`,
      [user.address]
    );

    const serverTime = new Date().toISOString();
    const serverTimeMs = Date.now();
    
    const requestsWithExpiry = result.rows.map(order => {
      const startTimeMs = new Date(order.start_time).getTime();
      const expiresAtMs = startTimeMs + (5 * 60 * 1000);
      const expiresAt = new Date(expiresAtMs).toISOString();
      const timeRemainingMs = expiresAtMs - serverTimeMs;
      const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
      const isExpired = timeRemainingMs <= 0;
      
      return {
        ...order,
        expires_at: expiresAt,
        expires_at_ms: expiresAtMs,
        time_remaining_seconds: timeRemainingSeconds,
        is_expired: isExpired
      };
    });

    const response: APIResponse = {
      success: true,
      data: requestsWithExpiry,
      meta: {
        server_time: serverTime,
        server_time_ms: serverTimeMs
      }
    };

    res.json(response);
  } catch (error) {
    console.error('💥 GET ORDER REQUESTS: Error occurred:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Sync order status with blockchain (for users)
router.post('/:id/sync-blockchain-status', authenticateToken, async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;
    
    console.log('🔄 SYNC BLOCKCHAIN STATUS: Starting sync for order:', orderId);
    console.log('👤 SYNC BLOCKCHAIN STATUS: User:', user?.address);

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
    if (order.buyer_address.toLowerCase() !== user.address.toLowerCase() && 
        order.seller_address.toLowerCase() !== user.address.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if blockchain_trade_id exists
    if (!order.blockchain_trade_id) {
      return res.status(400).json({
        success: false,
        error: 'No blockchain trade ID found for this order'
      });
    }

    // Get blockchain status
    const blockchainTrade = await contractService.getTradeFromChain(order.blockchain_trade_id);
    
    const status = Number(blockchainTrade.status);
    const statusNames = ['CREATED', 'LOCKED', 'RELEASED', 'APPEALED', 'APPEAL_WINDOW', 'REFUNDED', 'COMPLETED'];
    const blockchainStatusName = statusNames[status] || 'UNKNOWN';
    
    console.log('🔍 SYNC BLOCKCHAIN STATUS: Blockchain status check:', {
      orderId,
      tradeId: order.blockchain_trade_id,
      dbStatus: order.state,
      blockchainStatus: status,
      blockchainStatusName
    });

    let newOrderState = order.state;
    let needsUpdate = false;

    // Map blockchain status to database status - EXACT MATCH
    console.log('🔍 SYNC BLOCKCHAIN STATUS: Checking if update needed:', {
      blockchainStatus: status,
      blockchainStatusName,
      currentDbState: order.state
    });
    
    // Status 6 = COMPLETED on blockchain -> COMPLETED in database
    if (status === 6 && order.state !== 'COMPLETED') {
      newOrderState = 'COMPLETED';
      needsUpdate = true;
      console.log('✅ SYNC BLOCKCHAIN STATUS: Update required! Blockchain is COMPLETED but DB shows:', order.state);
    } 
    // Status 2 = RELEASED on blockchain -> RELEASED in database
    else if (status === 2 && order.state !== 'RELEASED') {
      newOrderState = 'RELEASED';
      needsUpdate = true;
      console.log('✅ SYNC BLOCKCHAIN STATUS: Update required! Blockchain is RELEASED but DB shows:', order.state);
    } 
    // Status 5 = REFUNDED on blockchain -> REFUNDED in database
    else if (status === 5 && order.state !== 'REFUNDED') {
      newOrderState = 'REFUNDED';
      needsUpdate = true;
      console.log('✅ SYNC BLOCKCHAIN STATUS: Update required! Blockchain is REFUNDED but DB shows:', order.state);
    } 
    // Status 1 = LOCKED on blockchain -> LOCKED in database
    else if (status === 1 && !['LOCKED', 'UNDER_DISPUTE', 'APPEALED'].includes(order.state)) {
      newOrderState = 'LOCKED';
      needsUpdate = true;
      console.log('✅ SYNC BLOCKCHAIN STATUS: Update required! Blockchain is LOCKED but DB shows:', order.state);
    } 
    // Status 4 = APPEAL_WINDOW on blockchain -> Keep as is (special state)
    else if (status === 4 && !['LOCKED', 'UNDER_DISPUTE', 'APPEALED'].includes(order.state)) {
      // Appeal window is still technically locked
      newOrderState = 'LOCKED';
      needsUpdate = true;
      console.log('✅ SYNC BLOCKCHAIN STATUS: Update required! Blockchain is APPEAL_WINDOW but DB shows:', order.state);
    }
    else {
      console.log('ℹ️ SYNC BLOCKCHAIN STATUS: No update needed, statuses match');
    }

    if (needsUpdate) {
      // Update database to match blockchain
      await pool.query(
        'UPDATE orders SET state = $1, updated_at = NOW() WHERE id = $2',
        [newOrderState, orderId]
      );

      console.log(`✅ SYNC BLOCKCHAIN STATUS: Order ${orderId} synced: ${order.state} → ${newOrderState}`);

      // Log the sync action
      await pool.query(
        'INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.address, 'SYNC_BLOCKCHAIN_STATUS', 'order', orderId, JSON.stringify({ 
          previousState: order.state, 
          newState: newOrderState,
          blockchainStatus: status 
        }), req.ip]
      );

      res.json({
        success: true,
        message: 'Order status synced with blockchain',
        data: {
          orderId,
          previousState: order.state,
          newState: newOrderState,
          blockchainStatus: status,
          blockchainStatusName,
          synced: true
        }
      });
    } else {
      res.json({
        success: true,
        message: 'Order status already in sync',
        data: {
          orderId,
          currentState: order.state,
          blockchainStatus: status,
          blockchainStatusName,
          synced: false
        }
      });
    }

  } catch (error) {
    console.error('💥 SYNC BLOCKCHAIN STATUS: Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync blockchain status'
    });
  }
});

export default router;