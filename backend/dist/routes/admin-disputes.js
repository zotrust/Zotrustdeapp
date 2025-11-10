"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../config/database"));
const contractService_1 = require("../services/contractService");
const router = express_1.default.Router();
const contractService = new contractService_1.ContractService();
// Validation schemas
const adminResolutionSchema = joi_1.default.object({
    resolution: joi_1.default.string().valid('TRANSFER_TO_BUYER', 'REFUND_TO_SELLER', 'SPLIT_REFUND').required(),
    resolution_reason: joi_1.default.string().min(10).max(500).required()
});
// Get all appeals for admin dashboard
router.get('/appeals', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        let query = `
      SELECT 
        a.id, a.dispute_id, a.order_id, a.appellant_address, a.appellant_type,
        a.description, a.evidence_video_url, a.evidence_screenshots, a.evidence_documents,
        a.created_at, a.status,
        d.status as dispute_status, d.dispute_type,
        -- keep commonly used scalar fields at top-level for backwards compatibility
        o.amount, o.token, o.buyer_address, o.seller_address,
        o.created_at as order_created_at, o.lock_expires_at,
        o.blockchain_trade_id,
        bu.name as buyer_name, su.name as seller_name,
        -- NEW: include the entire orders row as nested JSON (includes create_trade_tx_hash and all columns)
        row_to_json(o) as "order"
      FROM appeals a
      JOIN disputes d ON a.dispute_id = d.id
      JOIN orders o ON a.order_id = o.id
      LEFT JOIN users bu ON o.buyer_address = bu.address
      LEFT JOIN users su ON o.seller_address = su.address
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND d.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }
        query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        // Log for debugging - ensure blockchain_trade_id is present
        console.log(`📊 Admin Appeals API: Found ${result.rows.length} appeals`);
        result.rows.forEach((row, idx) => {
            console.log(`  Appeal ${idx + 1}: ID=${row.id}, OrderID=${row.order_id}, TradeID=${row.blockchain_trade_id}`);
        });
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('Get appeals error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get all disputes for admin dashboard
router.get('/disputes', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { status, priority, limit = 50, offset = 0 } = req.query;
        let query = `
      SELECT d.*, o.amount, o.token, o.buyer_address, o.seller_address,
             o.created_at as order_created_at, o.lock_expires_at,
             bu.name as buyer_name, su.name as seller_name
      FROM disputes d
      JOIN orders o ON d.order_id = o.id
      LEFT JOIN users bu ON o.buyer_address = bu.address
      LEFT JOIN users su ON o.seller_address = su.address
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND d.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }
        query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        // Get appeals for each dispute
        const disputesWithAppeals = await Promise.all(result.rows.map(async (dispute) => {
            const appealsResult = await database_1.default.query('SELECT * FROM appeals WHERE dispute_id = $1 ORDER BY created_at DESC', [dispute.id]);
            const timelineResult = await database_1.default.query('SELECT * FROM dispute_timeline WHERE dispute_id = $1 ORDER BY created_at DESC', [dispute.id]);
            return {
                ...dispute,
                appeals: appealsResult.rows,
                timeline: timelineResult.rows
            };
        }));
        const response = {
            success: true,
            data: disputesWithAppeals
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get admin disputes error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get dispute details
router.get('/disputes/:disputeId', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const disputeId = req.params.disputeId;
        const disputeResult = await database_1.default.query(`SELECT d.*, o.amount, o.token, o.buyer_address, o.seller_address,
              o.created_at as order_created_at, o.lock_expires_at,
              bu.name as buyer_name, su.name as seller_name
       FROM disputes d
       JOIN orders o ON d.order_id = o.id
       LEFT JOIN users bu ON o.buyer_address = bu.address
       LEFT JOIN users su ON o.seller_address = su.address
       WHERE d.id = $1`, [disputeId]);
        if (disputeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Dispute not found'
            });
        }
        const dispute = disputeResult.rows[0];
        // Get appeals
        const appealsResult = await database_1.default.query('SELECT * FROM appeals WHERE dispute_id = $1 ORDER BY created_at DESC', [disputeId]);
        // Get timeline
        const timelineResult = await database_1.default.query('SELECT * FROM dispute_timeline WHERE dispute_id = $1 ORDER BY created_at DESC', [disputeId]);
        // Get payment confirmations
        const confirmationResult = await database_1.default.query('SELECT * FROM payment_confirmations WHERE order_id = $1', [dispute.order_id]);
        res.json({
            success: true,
            data: {
                dispute,
                appeals: appealsResult.rows,
                timeline: timelineResult.rows,
                confirmations: confirmationResult.rows[0] || null
            }
        });
    }
    catch (error) {
        console.error('Get dispute details error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Admin resolve dispute
router.post('/disputes/:disputeId/resolve', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const disputeId = req.params.disputeId;
        const { error, value } = adminResolutionSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        console.log('🔄 ADMIN RESOLVE: Starting dispute resolution');
        console.log('📝 ADMIN RESOLVE: Dispute ID:', disputeId);
        console.log('📝 ADMIN RESOLVE: Resolution:', value.resolution);
        // Get dispute details
        const disputeResult = await database_1.default.query('SELECT * FROM disputes WHERE id = $1', [disputeId]);
        if (disputeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Dispute not found'
            });
        }
        const dispute = disputeResult.rows[0];
        // Check if dispute is already resolved
        if (dispute.status === 'RESOLVED') {
            return res.status(400).json({
                success: false,
                error: 'Dispute has already been resolved'
            });
        }
        // Get order details
        const orderResult = await database_1.default.query('SELECT * FROM orders WHERE id = $1', [dispute.order_id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        const order = orderResult.rows[0];
        let txHash = null;
        let newOrderState = '';
        try {
            // Execute resolution on blockchain
            if (value.resolution === 'TRANSFER_TO_BUYER') {
                // Release funds to buyer
                txHash = await contractService.releaseFundsOnChain(parseInt(dispute.order_id));
                newOrderState = 'RELEASED';
            }
            else if (value.resolution === 'REFUND_TO_SELLER') {
                // Refund to seller
                txHash = await contractService.refundOnChain(parseInt(dispute.order_id));
                newOrderState = 'REFUNDED';
            }
            else if (value.resolution === 'SPLIT_REFUND') {
                // For split refund, we need to implement a custom function
                // For now, we'll refund to seller (this needs smart contract support)
                txHash = await contractService.refundOnChain(parseInt(dispute.order_id));
                newOrderState = 'REFUNDED';
            }
            // Update dispute status
            await database_1.default.query(`UPDATE disputes SET 
          status = 'RESOLVED', 
          resolved_at = $1, 
          resolved_by = $2, 
          resolution = $3, 
          resolution_reason = $4
         WHERE id = $5`, [new Date(), req.user.address, value.resolution, value.resolution_reason, disputeId]);
            // Update order state
            await database_1.default.query('UPDATE orders SET state = $1, tx_hash = $2 WHERE id = $3', [newOrderState, txHash, dispute.order_id]);
            // Log timeline event
            await database_1.default.query(`INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by, metadata)
         VALUES ($1, $2, 'ADMIN_RESOLUTION', $3, $4, $5)`, [
                disputeId,
                dispute.order_id,
                `Admin resolved dispute: ${value.resolution}`,
                req.user.address,
                JSON.stringify({
                    resolution: value.resolution,
                    reason: value.resolution_reason,
                    txHash
                })
            ]);
            // Create admin notification
            await database_1.default.query(`INSERT INTO admin_notifications (dispute_id, order_id, notification_type, title, message, priority, status)
         VALUES ($1, $2, 'DISPUTE_RESOLVED', 'Dispute Resolved', $3, 'MEDIUM', 'ACTED_UPON')`, [
                disputeId,
                dispute.order_id,
                `Dispute #${disputeId} has been resolved: ${value.resolution}`
            ]);
            res.json({
                success: true,
                data: {
                    disputeId: parseInt(disputeId),
                    orderId: dispute.order_id,
                    resolution: value.resolution,
                    txHash,
                    newOrderState,
                    message: 'Dispute resolved successfully'
                }
            });
        }
        catch (contractError) {
            console.error('Contract resolution error:', contractError);
            res.status(500).json({
                success: false,
                error: 'Failed to execute resolution on blockchain'
            });
        }
    }
    catch (error) {
        console.error('Admin resolve dispute error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get admin notifications
router.get('/notifications', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { status, priority, limit = 50, offset = 0 } = req.query;
        let query = `
      SELECT n.*, d.dispute_type, o.amount, o.token, o.buyer_address, o.seller_address
      FROM admin_notifications n
      LEFT JOIN disputes d ON n.dispute_id = d.id
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND n.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }
        if (priority) {
            query += ` AND n.priority = $${paramIndex}`;
            queryParams.push(priority);
            paramIndex++;
        }
        query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        const response = {
            success: true,
            data: result.rows
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get admin notifications error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Mark notification as read
router.post('/notifications/:notificationId/read', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const notificationId = req.params.notificationId;
        await database_1.default.query('UPDATE admin_notifications SET status = $1, read_at = $2 WHERE id = $3', ['READ', new Date(), notificationId]);
        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Resolve appeal
router.post('/appeals/:appealId/resolve', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { appealId } = req.params;
        const { resolution, resolution_reason } = req.body;
        // Validate input
        const { error, value } = adminResolutionSchema.validate({ resolution, resolution_reason });
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        // Get appeal details
        const appealResult = await database_1.default.query('SELECT * FROM appeals WHERE id = $1', [appealId]);
        if (appealResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Appeal not found'
            });
        }
        const appeal = appealResult.rows[0];
        // Get order details
        const orderResult = await database_1.default.query('SELECT * FROM orders WHERE id = $1', [appeal.order_id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        const order = orderResult.rows[0];
        // Determine new order state based on resolution
        let newOrderState = '';
        if (value.resolution === 'TRANSFER_TO_BUYER') {
            newOrderState = 'RELEASED';
        }
        else if (value.resolution === 'REFUND_TO_SELLER') {
            newOrderState = 'REFUNDED';
        }
        else if (value.resolution === 'SPLIT_REFUND') {
            newOrderState = 'REFUNDED'; // For split refund, mark as refunded
        }
        // Update order state
        await database_1.default.query('UPDATE orders SET state = $1 WHERE id = $2', [newOrderState, appeal.order_id]);
        // Update appeal status
        await database_1.default.query('UPDATE appeals SET status = $1 WHERE id = $2', ['RESOLVED', appealId]);
        // Update dispute status
        await database_1.default.query('UPDATE disputes SET status = $1, resolution = $2, resolution_reason = $3, resolved_at = $4, resolved_by = $5 WHERE id = $6', ['RESOLVED', value.resolution, value.resolution_reason, new Date(), req.user?.address || 'ADMIN', appeal.dispute_id]);
        // Log timeline event
        await database_1.default.query(`INSERT INTO dispute_timeline (dispute_id, order_id, event_type, event_description, created_by, metadata)
       VALUES ($1, $2, 'APPEAL_RESOLVED', $3, $4, $5)`, [
            appeal.dispute_id,
            appeal.order_id,
            `Appeal resolved: ${value.resolution}`,
            req.user?.address || 'ADMIN',
            JSON.stringify({
                resolution: value.resolution,
                reason: value.resolution_reason,
                order_state: newOrderState
            })
        ]);
        res.json({
            success: true,
            message: 'Appeal resolved successfully',
            data: {
                appealId: parseInt(appealId),
                orderId: appeal.order_id,
                resolution: value.resolution,
                newOrderState,
                disputeId: appeal.dispute_id
            }
        });
    }
    catch (error) {
        console.error('Resolve appeal error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get dispute statistics
router.get('/disputes/stats', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const statsResult = await database_1.default.query(`
      SELECT 
        COUNT(*) as total_disputes,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_disputes,
        COUNT(CASE WHEN status = 'UNDER_REVIEW' THEN 1 END) as under_review_disputes,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved_disputes,
        COUNT(CASE WHEN resolution = 'TRANSFER_TO_BUYER' THEN 1 END) as buyer_wins,
        COUNT(CASE WHEN resolution = 'REFUND_TO_SELLER' THEN 1 END) as seller_wins,
        COUNT(CASE WHEN resolution = 'SPLIT_REFUND' THEN 1 END) as split_refunds
      FROM disputes
    `);
        const notificationsResult = await database_1.default.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN status = 'UNREAD' THEN 1 END) as unread_notifications,
        COUNT(CASE WHEN priority = 'URGENT' AND status = 'UNREAD' THEN 1 END) as urgent_unread
      FROM admin_notifications
    `);
        res.json({
            success: true,
            data: {
                disputes: statsResult.rows[0],
                notifications: notificationsResult.rows[0]
            }
        });
    }
    catch (error) {
        console.error('Get dispute stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
