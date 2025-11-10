
import pool from '../config/database';

// Simple in-memory job storage
const scheduledJobs = new Map<string, NodeJS.Timeout>();

// Timezone utilities for IST (UTC+05:30)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

// Convert UTC time to IST
const toIST = (utcDate: Date): Date => {
  return new Date(utcDate.getTime() + IST_OFFSET_MS);
};

// Get current IST time
const getCurrentIST = (): Date => {
  return toIST(new Date());
};

// Format IST time for logging
const formatISTDateTime = (date: Date): string => {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// Schedule order timeout (5 minutes for acceptance)
export const scheduleOrderTimeout = async (orderId: number) => {
  const delay = 5 * 60 * 1000; // 5 minutes in milliseconds
  const jobId = `order-timeout-${orderId}`;
  const currentIST = getCurrentIST();
  const expiryIST = new Date(currentIST.getTime() + delay);
  
  console.log(`⏰ Scheduling order timeout for order ${orderId}:`, {
    currentIST: formatISTDateTime(currentIST),
    expiryIST: formatISTDateTime(expiryIST),
    delayMs: delay,
    utcOffset: '+05:30 (IST)'
  });
  
  // Clear existing job if any
  if (scheduledJobs.has(jobId)) {
    clearTimeout(scheduledJobs.get(jobId)!);
  }
  
  // Schedule new timeout
  const timeoutId = setTimeout(async () => {
    await processOrderTimeout(orderId);
    scheduledJobs.delete(jobId);
  }, delay);
  
  scheduledJobs.set(jobId, timeoutId);
};

// Schedule lock expiry check
export const scheduleLockExpiry = async (orderId: number, lockExpiresAt: Date) => {
  const delay = lockExpiresAt.getTime() - Date.now();
  const jobId = `lock-expiry-${orderId}`;
  
  if (delay > 0) {
    // Clear existing job if any
    if (scheduledJobs.has(jobId)) {
      clearTimeout(scheduledJobs.get(jobId)!);
    }
    
    // Schedule new timeout
    const timeoutId = setTimeout(async () => {
      await processLockExpiry(orderId);
      scheduledJobs.delete(jobId);
    }, delay);
    
    scheduledJobs.set(jobId, timeoutId);
  }
};

// Remove scheduled job
export const removeScheduledJob = async (jobId: string) => {
  try {
    if (scheduledJobs.has(jobId)) {
      clearTimeout(scheduledJobs.get(jobId)!);
      scheduledJobs.delete(jobId);
    }
  } catch (error) {
    console.error('Error removing scheduled job:', error);
  }
};

// Process order timeout
const processOrderTimeout = async (orderId: number) => {
  let client = null;
  try {
    const currentIST = getCurrentIST();
    console.log(`⏰ Processing order timeout for order ${orderId} at ${formatISTDateTime(currentIST)} (IST)`);
    
    // Get a fresh client from the pool
    client = await pool.connect();
    
    // Check current order state
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      console.log(`Order ${orderId} not found`);
      return;
    }
    
    const order = orderResult.rows[0];
    const orderCreatedIST = toIST(new Date(order.created_at));
    
    // Only cancel if still in CREATED state
    if (order.state === 'CREATED') {
      await client.query(
        'UPDATE orders SET state = $1 WHERE id = $2',
        ['CANCELLED', orderId]
      );
      
      // Log automatic cancellation with timezone info
      await client.query(
        'INSERT INTO audit_logs (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4)',
        ['AUTO_CANCEL_ORDER', 'order', orderId.toString(), JSON.stringify({ 
          reason: 'Accept timeout',
          createdIST: formatISTDateTime(orderCreatedIST),
          cancelledIST: formatISTDateTime(currentIST),
          utcOffset: '+05:30 (IST)'
        })]
      );
      
      console.log(`✅ Order ${orderId} automatically cancelled due to timeout:`, {
        createdIST: formatISTDateTime(orderCreatedIST),
        cancelledIST: formatISTDateTime(currentIST),
        utcOffset: '+05:30 (IST)'
      });
      
      // TODO: Emit socket events to notify both parties
      // socketService.notifyUser(order.buyer_address, 'ORDER_CANCELLED', { orderId, reason: 'Accept timeout' });
      // socketService.notifyUser(order.seller_address, 'ORDER_CANCELLED', { orderId, reason: 'Accept timeout' });
    } else {
      console.log(`Order ${orderId} not in CREATED state (${order.state}), skipping timeout cancellation`);
    }
  } catch (error) {
    console.error(`❌ Error processing order timeout for order ${orderId}:`, error);
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Error releasing database client:', releaseError);
      }
    }
  }
};

// Process lock expiry
const processLockExpiry = async (orderId: number) => {
  let client = null;
  try {
    const currentIST = getCurrentIST();
    console.log(`🔒 Processing lock expiry for order ${orderId} at ${formatISTDateTime(currentIST)} (IST)`);
    
    // Get a fresh client from the pool
    client = await pool.connect();
    
    // Check current order state
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      console.log(`Order ${orderId} not found`);
      return;
    }
    
    const order = orderResult.rows[0];
    
    // Only process if still in ACCEPTED or LOCKED state
    if (['ACCEPTED', 'LOCKED'].includes(order.state)) {
      // Update state to allow dispute or refund
      await client.query(
        'UPDATE orders SET state = $1 WHERE id = $2',
        ['UNDER_DISPUTE', orderId]
      );
      
      // Log lock expiry with timezone info
      await client.query(
        'INSERT INTO audit_logs (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4)',
        ['AUTO_DISPUTE_ORDER', 'order', orderId.toString(), JSON.stringify({ 
          reason: 'Lock expired',
          disputedIST: formatISTDateTime(currentIST),
          utcOffset: '+05:30 (IST)'
        })]
      );
      
      console.log(`✅ Order ${orderId} moved to dispute due to lock expiry at ${formatISTDateTime(currentIST)} (IST)`);
      
      // TODO: Emit socket events to notify both parties
      // socketService.notifyUser(order.buyer_address, 'ORDER_DISPUTED', { orderId, reason: 'Lock expired' });
      // socketService.notifyUser(order.seller_address, 'ORDER_DISPUTED', { orderId, reason: 'Lock expired' });
    } else {
      console.log(`Order ${orderId} not in lockable state (${order.state}), skipping lock expiry`);
    }
  } catch (error) {
    console.error(`❌ Error processing lock expiry for order ${orderId}:`, error);
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Error releasing database client:', releaseError);
      }
    }
  }
};

// Cleanup expired OTPs (runs every hour)
export const scheduleOTPCleanup = () => {
  // Run cleanup immediately
  processOTPCleanup();
  
  // Schedule cleanup every hour
  setInterval(() => {
    processOTPCleanup();
  }, 60 * 60 * 1000); // 1 hour in milliseconds
};

const processOTPCleanup = async () => {
  let client = null;
  try {
    // Get a fresh client from the pool
    client = await pool.connect();
    
    const result = await client.query('DELETE FROM otp_logs WHERE expires_at < NOW()');
    console.log(`Cleaned up ${result.rowCount} expired OTP records`);
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Error releasing database client:', releaseError);
      }
    }
  }
};

// Check and mark expired orders (runs every minute)
export const scheduleExpiredOrdersCheck = () => {
  const currentIST = getCurrentIST();
  console.log(`⏰ Expired orders check scheduled (runs every minute) - Started at ${formatISTDateTime(currentIST)} (IST) UTC+05:30`);
  
  // Run check immediately on startup
  processExpiredOrdersCheck();
  
  // Schedule check every minute
  setInterval(() => {
    processExpiredOrdersCheck();
  }, 60 * 1000); // 1 minute in milliseconds
};

const processExpiredOrdersCheck = async () => {
  let client = null;
  try {
    const ACCEPT_TIMEOUT_MINUTES = 5;
    const currentIST = getCurrentIST();
    
    // Get a fresh client from the pool to avoid connection issues
    client = await pool.connect();
    
    // Mark orders as expired if they are in CREATED state and older than 5 minutes
    const result = await client.query(
      `UPDATE orders 
       SET state = 'EXPIRED' 
       WHERE state = 'CREATED' 
       AND created_at < NOW() - INTERVAL '${ACCEPT_TIMEOUT_MINUTES} minutes'
       RETURNING id, buyer_address, seller_address, created_at`
    );
    
    if (result.rowCount && result.rowCount > 0) {
      console.log(`⏰ Marked ${result.rowCount} orders as EXPIRED at ${formatISTDateTime(currentIST)} (IST):`, 
        result.rows.map(r => `#${r.id}`).join(', ')
      );
      
      // Log each expired order with timezone info
      for (const order of result.rows) {
        try {
          const orderCreatedIST = toIST(new Date(order.created_at));
          await client.query(
            'INSERT INTO audit_logs (action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4)',
            [
              'AUTO_EXPIRE_ORDER', 
              'order', 
              order.id.toString(), 
              JSON.stringify({ 
                reason: 'Accept timeout exceeded',
                created_at: order.created_at,
                createdIST: formatISTDateTime(orderCreatedIST),
                expiredIST: formatISTDateTime(currentIST),
                timeout_minutes: ACCEPT_TIMEOUT_MINUTES,
                utcOffset: '+05:30 (IST)'
              })
            ]
          );
        } catch (logError) {
          console.error(`❌ Error logging expired order ${order.id}:`, logError);
          // Continue with other orders even if logging fails
        }
      }
      
      // TODO: Emit socket events to notify both parties about expiration
    } else {
      // Log that no orders were expired (for debugging)
      console.log(`✅ No orders expired at ${formatISTDateTime(currentIST)} (IST) - UTC+05:30`);
    }
  } catch (error) {
    console.error('❌ Error checking expired orders:', error);
    
    // If it's a connection error, try to reconnect
    if (error.message && error.message.includes('Connection terminated')) {
      console.log('🔄 Connection terminated, will retry on next interval...');
    }
  } finally {
    // Always release the client back to the pool
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('❌ Error releasing database client:', releaseError);
      }
    }
  }
};
