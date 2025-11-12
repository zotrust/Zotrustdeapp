import pool from '../config/database';
import { ContractService } from '../services/contractService';

const contractService = new ContractService();

// Check for orders that need automatic dispute processing
export const processDisputeTimeouts = async () => {
  try {
    console.log('🔄 DISPUTE WORKER: Checking for dispute timeouts');

    // Find orders that are LOCKED and past the 2-hour confirmation window
    const expiredOrdersResult = await pool.query(`
      SELECT o.*, pc.buyer_confirmed, pc.seller_confirmed
      FROM orders o
      LEFT JOIN payment_confirmations pc ON o.id = pc.order_id
      WHERE o.state = 'LOCKED' 
        AND o.lock_expires_at < NOW()
        AND (pc.id IS NULL OR (pc.buyer_confirmed = false OR pc.seller_confirmed = false))
    `);

    console.log(`📊 DISPUTE WORKER: Found ${expiredOrdersResult.rows.length} orders past confirmation window`);

    for (const order of expiredOrdersResult.rows) {
      await processExpiredOrder(order);
    }

    // Check for disputes past appeal deadline
    const expiredAppealsResult = await pool.query(`
      SELECT o.*, d.id as dispute_id
      FROM orders o
      JOIN disputes d ON o.id = d.order_id
      WHERE o.state = 'UNDER_DISPUTE' 
        AND o.appeal_deadline < NOW()
        AND d.status = 'PENDING'
    `);

    console.log(`📊 DISPUTE WORKER: Found ${expiredAppealsResult.rows.length} disputes past appeal deadline`);

    for (const order of expiredAppealsResult.rows) {
      await processExpiredAppeal(order);
    }

  } catch (error) {
    console.error('❌ DISPUTE WORKER: Error processing dispute timeouts:', error);
  }
};

// Process individual expired order
const processExpiredOrder = async (order: any) => {
  try {
    console.log(`🔄 DISPUTE WORKER: Processing expired order ${order.id}`);

    // Check if dispute already exists
    const existingDispute = await pool.query(
      'SELECT * FROM disputes WHERE order_id = $1',
      [order.id]
    );

    if (existingDispute.rows.length > 0) {
      console.log(`⏭️ DISPUTE WORKER: Dispute already exists for order ${order.id}`);
      return;
    }

    // Create dispute automatically
    const disputeResult = await pool.query(
      `INSERT INTO disputes (order_id, dispute_type, created_by, status)
       VALUES ($1, 'PAYMENT_NOT_RECEIVED', 'SYSTEM', 'PENDING')
       RETURNING *`,
      [order.id]
    );

    const disputeId = disputeResult.rows[0].id;

    // Update order state
    await pool.query(
      'UPDATE orders SET state = $1, dispute_id = $2, appeal_deadline = $3 WHERE id = $4',
      ['UNDER_DISPUTE', disputeId, new Date(Date.now() + (48 * 60 * 60 * 1000)), order.id]
    );

    // Log timeline event
    await pool.query(
      `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by, metadata)
       VALUES ($1, $2, 'AUTO_DISPUTE', 'Order automatically moved to dispute due to timeout', 'SYSTEM', $3)`,
      [
        disputeId,
        order.id,
        JSON.stringify({ 
          reason: '2-hour confirmation window expired',
          buyer_confirmed: order.buyer_confirmed || false,
          seller_confirmed: order.seller_confirmed || false
        })
      ]
    );

    // Create admin notification
    const notificationMessage = `Order #${order.id} automatically moved to dispute due to timeout`;
    await pool.query(
      `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority)
       VALUES ($1, $2, 'AUTO_DISPUTE', 'Order Auto-Disputed', $3, 'HIGH')`,
      [disputeId, order.id, notificationMessage]
    );

    console.log(`✅ DISPUTE WORKER: Order ${order.id} moved to dispute automatically`);

  } catch (error) {
    console.error(`❌ DISPUTE WORKER: Error processing expired order ${order.id}:`, error);
  }
};

// Process expired appeal (no appeals filed within 48 hours)
const processExpiredAppeal = async (order: any) => {
  try {
    console.log(`🔄 DISPUTE WORKER: Processing expired appeal for order ${order.id}`);

    // Check if any appeals were filed
    const appealsResult = await pool.query(
      'SELECT * FROM appeals WHERE dispute_id = $1',
      [order.dispute_id]
    );

    if (appealsResult.rows.length > 0) {
      console.log(`⏭️ DISPUTE WORKER: Appeals exist for dispute ${order.dispute_id}, skipping auto-refund`);
      return;
    }

    // No appeals filed - auto-refund to seller
    try {
      const txHash = await contractService.refundOnChain(parseInt(order.id));
      
      // Update dispute status
      await pool.query(
        `UPDATE disputes SET 
          status = 'RESOLVED', 
          resolved_at = $1, 
          resolved_by = 'SYSTEM', 
          resolution = 'REFUND_TO_SELLER', 
          resolution_reason = 'No appeals filed within 48 hours - automatic refund to seller'
         WHERE id = $2`,
        [new Date(), order.dispute_id]
      );

      // Update order state
      await pool.query(
        'UPDATE orders SET state = $1, tx_hash = $2 WHERE id = $3',
        ['REFUNDED', txHash, order.id]
      );

      // Log timeline event
      await pool.query(
        `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by, metadata)
         VALUES ($1, $2, 'AUTO_REFUND', 'Automatic refund due to no appeals', 'SYSTEM', $3)`,
        [
          order.dispute_id,
          order.id,
          JSON.stringify({ 
            reason: 'No appeals filed within 48 hours',
            txHash 
          })
        ]
      );

      // Create admin notification
      const refundNotificationMessage = `Order #${order.id} automatically refunded due to no appeals`;
      try {
      await pool.query(
        `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority, status)
           VALUES ($1, $2, 'AUTO_REFUND', 'Auto-Refund Executed', $3, 'MEDIUM', 'READ')`,
          [order.dispute_id, order.id, refundNotificationMessage]
        );
      } catch (dbError: any) {
        // If status constraint fails, try without status (let DB use default)
        console.warn('⚠️ DISPUTE WORKER: Status constraint error, trying without status field:', dbError.message);
        try {
          await pool.query(
            `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority)
             VALUES ($1, $2, 'AUTO_REFUND', 'Auto-Refund Executed', $3, 'MEDIUM')`,
        [order.dispute_id, order.id, refundNotificationMessage]
      );
        } catch (retryError) {
          console.error('❌ DISPUTE WORKER: Failed to create notification even without status:', retryError);
        }
      }

      console.log(`✅ DISPUTE WORKER: Order ${order.id} automatically refunded`);

    } catch (contractError: any) {
      console.error(`❌ DISPUTE WORKER: Contract error for order ${order.id}:`, contractError);
      
      // Check if it's an insufficient funds error
      const isInsufficientFunds = contractError.message?.includes('INSUFFICIENT_FUNDS') || 
                                  contractError.code === 'INSUFFICIENT_FUNDS' ||
                                  contractError.message?.includes('insufficient funds');
      
      // Log the error
      await pool.query(
        `INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by, metadata)
         VALUES ($1, $2, 'AUTO_REFUND_FAILED', 'Automatic refund failed', 'SYSTEM', $3)`,
        [
          order.dispute_id,
          order.id,
          JSON.stringify({ 
            error: contractError.message || 'Unknown error',
            reason: isInsufficientFunds ? 'Insufficient BNB in relayer wallet for gas fees' : 'Contract execution failed',
            errorCode: contractError.code,
            isInsufficientFunds
          })
        ]
      );

      // Create high-priority admin notification for insufficient funds
      if (isInsufficientFunds) {
        const errorMessage = contractError.message || 'Insufficient funds in relayer wallet';
        try {
          await pool.query(
            `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority, status)
             VALUES ($1, $2, 'AUTO_REFUND_FAILED', '⚠️ Auto-Refund Failed: Insufficient Funds', $3, 'HIGH', 'UNREAD')`,
            [order.dispute_id, order.id, `Order #${order.id} could not be auto-refunded: ${errorMessage}. Please fund the relayer wallet and manually process this refund.`]
          );
          console.error(`🚨 DISPUTE WORKER: HIGH PRIORITY - Relayer wallet needs funding for order ${order.id}`);
        } catch (dbError: any) {
          // If status constraint fails, try without status (let DB use default)
          console.warn('⚠️ DISPUTE WORKER: Status constraint error, trying without status field:', dbError.message);
          try {
            await pool.query(
              `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority)
               VALUES ($1, $2, 'AUTO_REFUND_FAILED', '⚠️ Auto-Refund Failed: Insufficient Funds', $3, 'HIGH')`,
              [order.dispute_id, order.id, `Order #${order.id} could not be auto-refunded: ${errorMessage}. Please fund the relayer wallet and manually process this refund.`]
            );
          } catch (retryError) {
            console.error('❌ DISPUTE WORKER: Failed to create notification even without status:', retryError);
          }
        }
      } else {
        // Regular error notification
        try {
          await pool.query(
            `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority, status)
             VALUES ($1, $2, 'AUTO_REFUND_FAILED', 'Auto-Refund Failed', $3, 'MEDIUM', 'UNREAD')`,
            [order.dispute_id, order.id, `Order #${order.id} could not be auto-refunded: ${contractError.message || 'Unknown error'}`]
          );
        } catch (dbError: any) {
          // If status constraint fails, try without status (let DB use default)
          console.warn('⚠️ DISPUTE WORKER: Status constraint error, trying without status field:', dbError.message);
          try {
            await pool.query(
              `INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority)
               VALUES ($1, $2, 'AUTO_REFUND_FAILED', 'Auto-Refund Failed', $3, 'MEDIUM')`,
              [order.dispute_id, order.id, `Order #${order.id} could not be auto-refunded: ${contractError.message || 'Unknown error'}`]
            );
          } catch (retryError) {
            console.error('❌ DISPUTE WORKER: Failed to create notification even without status:', retryError);
          }
        }
      }
    }

  } catch (error) {
    console.error(`❌ DISPUTE WORKER: Error processing expired appeal for order ${order.id}:`, error);
  }
};

// Schedule dispute processing (runs every 5 minutes)
export const scheduleDisputeProcessing = () => {
  // Run immediately on startup
  processDisputeTimeouts();
  
  // Schedule to run every 5 minutes
  setInterval(processDisputeTimeouts, 5 * 60 * 1000);
  
  console.log('⏰ DISPUTE WORKER: Scheduled dispute processing (every 5 minutes)');
};
