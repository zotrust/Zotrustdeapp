"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../config/database"));
const router = express_1.default.Router();
// Validation schemas
const initiateCallSchema = joi_1.default.object({
    receiver_address: joi_1.default.string()
        .custom((value, helpers) => {
        // Allow 'ADMIN_SUPPORT' as a special case (case-insensitive)
        const normalized = value.toLowerCase();
        if (normalized === 'admin_support') {
            return value; // Return as-is
        }
        // Otherwise, must be exactly 42 characters (Ethereum address)
        if (value.length !== 42) {
            return helpers.error('string.length');
        }
        return value;
    })
        .required()
        .messages({
        'string.length': '"receiver_address" length must be 42 characters long'
    }),
    ad_id: joi_1.default.string().optional(),
    signaling_data: joi_1.default.object().optional()
});
const updateCallSchema = joi_1.default.object({
    status: joi_1.default.string().valid('active', 'ended', 'failed').required(),
    signaling_data: joi_1.default.object().optional()
});
// Initiate call
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { error, value } = initiateCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const user = req.user;
        const { receiver_address, signaling_data } = value;
        // Handle admin support calls
        let actualReceiverAddress = receiver_address.toLowerCase();
        let isAdminSupportCall = false;
        if (receiver_address === 'ADMIN_SUPPORT' || receiver_address.toLowerCase() === 'admin_support') {
            isAdminSupportCall = true;
            // Get admin support address from settings
            const adminSupportResult = await database_1.default.query('SELECT value FROM app_settings WHERE key = $1', ['admin_support_address']);
            if (adminSupportResult.rows.length > 0 && adminSupportResult.rows[0].value) {
                actualReceiverAddress = adminSupportResult.rows[0].value.toLowerCase();
            }
            else {
                // Use special admin identifier - ensure user exists in database
                // Create a valid 42-character placeholder address for admin support
                // Format: 0x + 40 hex characters (0x + 40 chars = 42 total)
                const adminSupportPlaceholder = '0x' + 'admin'.padEnd(40, '0').toLowerCase();
                actualReceiverAddress = adminSupportPlaceholder;
                // Check if admin support user exists, create if not
                const adminUserCheck = await database_1.default.query('SELECT * FROM users WHERE address = $1', [adminSupportPlaceholder]);
                if (adminUserCheck.rows.length === 0) {
                    // Create placeholder admin support user
                    await database_1.default.query(`INSERT INTO users (address, name, verified)
             VALUES ($1, $2, $3)
             ON CONFLICT (address) DO NOTHING`, [adminSupportPlaceholder, 'Admin Support', true]);
                }
            }
        }
        // Check if receiver exists
        const receiverResult = await database_1.default.query('SELECT * FROM users WHERE address = $1', [actualReceiverAddress]);
        if (receiverResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Receiver not found'
            });
        }
        // Check if caller is trying to call themselves
        if (user.address.toLowerCase() === actualReceiverAddress.toLowerCase() && !isAdminSupportCall) {
            return res.status(400).json({
                success: false,
                error: 'Cannot call yourself'
            });
        }
        // Create call record with admin support flag in signaling data
        const callSignalingData = {
            ...(signaling_data || {}),
            isAdminSupportCall,
            supportCall: isAdminSupportCall
        };
        const result = await database_1.default.query(`INSERT INTO calls (caller_address, receiver_address, signaling_data)
       VALUES ($1, $2, $3)
       RETURNING *`, [user.address, actualReceiverAddress, JSON.stringify(callSignalingData)]);
        const call = result.rows[0];
        // Log call initiation
        await database_1.default.query('INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)', [user.address, 'INITIATE_CALL', 'call', call.id.toString(), JSON.stringify({ receiver_address }), req.ip]);
        // TODO: Emit socket event to notify receiver
        // socketService.notifyUser(receiver_address, 'INCOMING_CALL', call);
        const response = {
            success: true,
            data: call,
            message: 'Call initiated successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Initiate call error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get call details
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const callId = req.params.id;
        const user = req.user;
        const result = await database_1.default.query(`SELECT c.*, 
              cu.name as caller_name, 
              ru.name as receiver_name
       FROM calls c
       LEFT JOIN users cu ON c.caller_address = cu.address
       LEFT JOIN users ru ON c.receiver_address = ru.address
       WHERE c.id = $1 AND (c.caller_address = $2 OR c.receiver_address = $2)`, [callId, user.address]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Call not found or access denied'
            });
        }
        const response = {
            success: true,
            data: result.rows[0]
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get call error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update call status
router.patch('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const callId = req.params.id;
        const user = req.user;
        const { error, value } = updateCallSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const { status, signaling_data } = value;
        // Check if call exists and user has access
        const callResult = await database_1.default.query('SELECT * FROM calls WHERE id = $1 AND (caller_address = $2 OR receiver_address = $2)', [callId, user.address]);
        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Call not found or access denied'
            });
        }
        // Build update query
        const updates = [];
        const values = [];
        let paramIndex = 1;
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
        if (signaling_data) {
            updates.push(`signaling_data = $${paramIndex}`);
            values.push(JSON.stringify(signaling_data));
            paramIndex++;
        }
        if (status === 'ended') {
            updates.push(`ended_at = NOW()`);
        }
        values.push(callId);
        const query = `UPDATE calls SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await database_1.default.query(query, values);
        // Log call update
        await database_1.default.query('INSERT INTO audit_logs (user_address, action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)', [user.address, 'UPDATE_CALL', 'call', callId, JSON.stringify({ status }), req.ip]);
        // TODO: Emit socket event to notify other party
        const call = callResult.rows[0];
        const otherParty = user.address.toLowerCase() === call.caller_address.toLowerCase()
            ? call.receiver_address
            : call.caller_address;
        // socketService.notifyUser(otherParty, 'CALL_STATUS_UPDATED', result.rows[0]);
        const response = {
            success: true,
            data: result.rows[0],
            message: 'Call status updated successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Update call error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get user's call history
router.get('/history/list', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const { limit = 50, offset = 0 } = req.query;
        const result = await database_1.default.query(`SELECT c.*, 
              cu.name as caller_name, 
              ru.name as receiver_name,
              CASE 
                WHEN c.caller_address = $1 THEN 'outgoing'
                ELSE 'incoming'
              END as call_direction
       FROM calls c
       LEFT JOIN users cu ON c.caller_address = cu.address
       LEFT JOIN users ru ON c.receiver_address = ru.address
       WHERE (c.caller_address = $1 OR c.receiver_address = $1)
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`, [user.address, limit, offset]);
        const response = {
            success: true,
            data: result.rows
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get call history error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// End call
router.post('/:id/end', auth_1.authenticateToken, async (req, res) => {
    try {
        const callId = req.params.id;
        const user = req.user;
        // Handle support call IDs (format: "support-call-{timestamp}")
        const isSupportCall = callId.startsWith('support-call-');
        if (isSupportCall) {
            // For support calls, we don't need to query the database
            // Just log the call end and return success
            // The actual call management is handled via WebRTC/socket
            await database_1.default.query('INSERT INTO audit_logs (user_address, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [user.address, 'END_SUPPORT_CALL', 'call', callId, req.ip]);
            const response = {
                success: true,
                message: 'Support call ended successfully'
            };
            return res.json(response);
        }
        // For regular calls, validate the ID is numeric
        const numericCallId = parseInt(callId, 10);
        if (isNaN(numericCallId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid call ID format'
            });
        }
        // Check if call exists and user has access
        const callResult = await database_1.default.query('SELECT * FROM calls WHERE id = $1 AND (caller_address = $2 OR receiver_address = $2)', [numericCallId, user.address]);
        if (callResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Call not found or access denied'
            });
        }
        const call = callResult.rows[0];
        // Update call status to ended
        await database_1.default.query('UPDATE calls SET status = $1, ended_at = NOW() WHERE id = $2', ['ended', numericCallId]);
        // Log call end
        await database_1.default.query('INSERT INTO audit_logs (user_address, action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4, $5)', [user.address, 'END_CALL', 'call', numericCallId.toString(), req.ip]);
        // TODO: Emit socket event to notify other party
        const otherParty = user.address.toLowerCase() === call.caller_address.toLowerCase()
            ? call.receiver_address
            : call.caller_address;
        // socketService.notifyUser(otherParty, 'CALL_ENDED', { callId });
        const response = {
            success: true,
            message: 'Call ended successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('End call error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
