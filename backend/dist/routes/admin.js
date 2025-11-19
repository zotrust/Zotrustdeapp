"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../config/database"));
const contractService_1 = require("../services/contractService");
const router = express_1.default.Router();
const contractService = new contractService_1.ContractService();
// Admin login credentials (static for now)
const ADMIN_EMAIL = 'admin@zotrust.com';
const ADMIN_PASSWORD = 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024';
// Admin login route
router.post('/login', async (req, res) => {
    try {
        console.log('📋 Admin login request received:', {
            path: req.path,
            method: req.method,
            host: req.get('host'),
            origin: req.get('origin'),
            ip: req.ip
        });
        const { email, password } = req.body;
        console.log('📋 Admin login credentials:', { email, hasPassword: !!password });
        // Validate input
        if (!email || !password) {
            console.log('❌ Admin login: Missing credentials');
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        // Check credentials
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            // Generate JWT token
            const payload = {
                email: ADMIN_EMAIL,
                role: 'admin',
                address: '0x0000000000000000000000000000000000000000' // Dummy address for admin
            };
            console.log('Admin login - Creating token with payload:', payload);
            console.log('Admin login - JWT_SECRET:', JWT_SECRET);
            const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d' });
            console.log('Admin login - Generated token:', token);
            console.log('✅ Admin login successful');
            return res.json({
                success: true,
                data: {
                    token,
                    user: {
                        email: ADMIN_EMAIL,
                        role: 'admin'
                    }
                }
            });
        }
        else {
            console.log('❌ Admin login: Invalid credentials');
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
    }
    catch (error) {
        console.error('❌ Admin login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Debug endpoint to test JWT secret
router.get('/debug-jwt', async (req, res) => {
    try {
        const testPayload = { role: 'admin', email: 'test@test.com' };
        const testToken = jsonwebtoken_1.default.sign(testPayload, JWT_SECRET, { expiresIn: '1h' });
        res.json({
            success: true,
            jwtSecret: JWT_SECRET,
            testToken,
            testPayload
        });
    }
    catch (error) {
        console.error('Debug JWT error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Test endpoint to verify JWT token
router.get('/test-token', auth_1.authenticateAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Token is valid',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Test token error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Dashboard stats endpoint
router.get('/dashboard-stats', auth_1.authenticateAdmin, async (req, res) => {
    try {
        // Get total orders
        const ordersResult = await database_1.default.query('SELECT COUNT(*) as count FROM orders');
        const totalOrders = parseInt(ordersResult.rows[0].count);
        // Get total transactions
        const transactionsResult = await database_1.default.query('SELECT COUNT(*) as count FROM transactions');
        const totalTransactions = parseInt(transactionsResult.rows[0].count);
        // Get total disputes
        const disputesResult = await database_1.default.query('SELECT COUNT(*) as count FROM disputes');
        const totalDisputes = parseInt(disputesResult.rows[0].count);
        // Get pending disputes
        const pendingDisputesResult = await database_1.default.query('SELECT COUNT(*) as count FROM disputes WHERE status = $1', ['PENDING']);
        const pendingDisputes = parseInt(pendingDisputesResult.rows[0].count);
        // Get total agents
        const agentsResult = await database_1.default.query('SELECT COUNT(*) as count FROM agents');
        const totalAgents = parseInt(agentsResult.rows[0].count);
        // Get total locations
        const locationsResult = await database_1.default.query('SELECT COUNT(*) as count FROM locations');
        const totalLocations = parseInt(locationsResult.rows[0].count);
        // Get completed orders
        const completedOrdersResult = await database_1.default.query('SELECT COUNT(*) as count FROM orders WHERE state = $1', ['RELEASED']);
        const completedOrders = parseInt(completedOrdersResult.rows[0].count);
        // Get total volume (sum of all order amounts)
        const volumeResult = await database_1.default.query('SELECT COALESCE(SUM(o.amount * a.price_inr), 0) as total_volume FROM orders o JOIN ads a ON o.ad_id = a.id WHERE o.state = $1', ['RELEASED']);
        const totalVolume = parseFloat(volumeResult.rows[0].total_volume) || 0;
        const stats = {
            totalOrders,
            totalTransactions,
            totalDisputes,
            totalAgents,
            totalLocations,
            pendingDisputes,
            completedOrders,
            totalVolume
        };
        const response = {
            success: true,
            data: stats
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Validation schemas
const createAgentSchema = joi_1.default.object({
    branch_name: joi_1.default.string().max(255).required(),
    mobile: joi_1.default.string().max(20).required(),
    address: joi_1.default.string().max(500).optional(),
    location_id: joi_1.default.number().integer().required(),
    verified: joi_1.default.boolean().default(false)
});
const updateAgentSchema = joi_1.default.object({
    branch_name: joi_1.default.string().max(255).optional(),
    mobile: joi_1.default.string().max(20).optional(),
    address: joi_1.default.string().max(500).optional(),
    location_id: joi_1.default.number().integer().optional(),
    verified: joi_1.default.boolean().optional()
});
const setFeeWalletSchema = joi_1.default.object({
    address: joi_1.default.string().length(42).required()
});
// Create agent
router.post('/agents', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { error, value } = createAgentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const agentData = value;
        // Get city from location_id
        const locationResult = await database_1.default.query('SELECT city FROM locations WHERE id = $1', [agentData.location_id]);
        if (locationResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid location_id'
            });
        }
        const city = locationResult.rows[0].city;
        const result = await database_1.default.query(`INSERT INTO agents (branch_name, city, mobile, address, location_id, verified, created_by_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [
            agentData.branch_name,
            city,
            agentData.mobile,
            agentData.address || '',
            agentData.location_id,
            agentData.verified,
            1 // Admin ID
        ]);
        // Log agent creation
        await database_1.default.query('INSERT INTO audit_logs (action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5)', ['ADMIN_CREATE_AGENT', 'agent', result.rows[0].id.toString(), JSON.stringify(agentData), req.ip]);
        const response = {
            success: true,
            data: result.rows[0],
            message: 'Agent created successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Create agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get all agents
router.get('/agents', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { city, state, country, verified, limit = 100, offset = 0 } = req.query;
        let query = `
      SELECT a.*, 
             l.name as location_name
      FROM agents a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (city) {
            query += ` AND l.name ILIKE $${paramIndex}`;
            queryParams.push(`%${city}%`);
            paramIndex++;
        }
        if (verified !== undefined) {
            query += ` AND a.verified = $${paramIndex}`;
            queryParams.push(verified === 'true');
            paramIndex++;
        }
        query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        const response = {
            success: true,
            data: result.rows
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get agents error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update agent
router.patch('/agents/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const agentId = req.params.id;
        const { error, value } = updateAgentSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const updates = [];
        const values = [];
        let paramIndex = 1;
        // Handle location_id update - need to get city from location
        if (value.location_id !== undefined) {
            const locationResult = await database_1.default.query('SELECT city FROM locations WHERE id = $1', [value.location_id]);
            if (locationResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid location_id'
                });
            }
            const city = locationResult.rows[0].city;
            updates.push(`location_id = $${paramIndex}`);
            values.push(value.location_id);
            paramIndex++;
            updates.push(`city = $${paramIndex}`);
            values.push(city);
            paramIndex++;
        }
        Object.entries(value).forEach(([key, val]) => {
            if (val !== undefined && key !== 'location_id') {
                updates.push(`${key} = $${paramIndex}`);
                values.push(val);
                paramIndex++;
            }
        });
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid updates provided'
            });
        }
        updates.push(`updated_at = NOW()`);
        values.push(agentId);
        const query = `UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const result = await database_1.default.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        // Log agent update
        await database_1.default.query('INSERT INTO audit_logs (action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5)', ['ADMIN_UPDATE_AGENT', 'agent', agentId, JSON.stringify(value), req.ip]);
        const response = {
            success: true,
            data: result.rows[0],
            message: 'Agent updated successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Update agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Delete agent
router.delete('/agents/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const agentId = req.params.id;
        // Check if agent has active ads
        const adsResult = await database_1.default.query('SELECT COUNT(*) as count FROM ads WHERE owner_selected_agent_id = $1 AND active = true', [agentId]);
        if (parseInt(adsResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete agent with active ads'
            });
        }
        // Check if agent has users
        const usersResult = await database_1.default.query('SELECT COUNT(*) as count FROM users WHERE selected_agent_id = $1', [agentId]);
        if (parseInt(usersResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete agent with associated users'
            });
        }
        // Delete agent
        const result = await database_1.default.query('DELETE FROM agents WHERE id = $1 RETURNING *', [agentId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        // Log agent deletion
        await database_1.default.query('INSERT INTO audit_logs (action, resource_type, resource_id, ip_address) VALUES ($1, $2, $3, $4)', ['ADMIN_DELETE_AGENT', 'agent', agentId, req.ip]);
        const response = {
            success: true,
            message: 'Agent deleted successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Delete agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get all orders
router.get('/orders', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { state, token, limit = 100, offset = 0 } = req.query;
        let query = `
      SELECT o.*, a.type as ad_type, a.price_inr, a.min_amount, a.max_amount,
             bu.name as buyer_name, bu.phone as buyer_mobile,
             su.name as seller_name, su.phone as seller_mobile,
             ag.branch_name as agent_branch, ag.mobile as agent_mobile, ag.address as agent_address,
             l.city as location_city, l.state as location_state, l.country as location_country,
             pc.buyer_confirmed_at, pc.seller_confirmed_at, pc.buyer_confirmed, pc.seller_confirmed,
             d.status as dispute_status, d.created_at as dispute_created_at,
             ap.status as appeal_status, ap.created_at as appeal_created_at
      FROM orders o
      JOIN ads a ON o.ad_id = a.id
      LEFT JOIN users bu ON o.buyer_address = bu.address
      LEFT JOIN users su ON o.seller_address = su.address
      LEFT JOIN agents ag ON o.agent_branch = ag.branch_name
      LEFT JOIN locations l ON ag.location_id = l.id
      LEFT JOIN payment_confirmations pc ON o.id = pc.order_id
      LEFT JOIN disputes d ON o.dispute_id = d.id
      LEFT JOIN appeals ap ON o.id = ap.order_id
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (state) {
            query += ` AND o.state = $${paramIndex}`;
            queryParams.push(state);
            paramIndex++;
        }
        if (token) {
            query += ` AND o.token = $${paramIndex}`;
            queryParams.push(token);
            paramIndex++;
        }
        query += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        const response = {
            success: true,
            data: result.rows
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get admin orders error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Manual refund
router.post('/orders/:id/refund', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { reason } = req.body;
        // Get order details
        const orderResult = await database_1.default.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        const order = orderResult.rows[0];
        // Check if order can be refunded
        if (!['ACCEPTED', 'LOCKED', 'UNDER_DISPUTE'].includes(order.state)) {
            return res.status(400).json({
                success: false,
                error: 'Order cannot be refunded in current state'
            });
        }
        try {
            // Refund via contract
            const txHash = await contractService.refundOnChain(parseInt(orderId));
            // Log admin refund
            await database_1.default.query('INSERT INTO audit_logs (action, resource_type, resource_id, details, ip_address) VALUES ($1, $2, $3, $4, $5)', ['ADMIN_REFUND_ORDER', 'order', orderId, JSON.stringify({ reason, txHash }), req.ip]);
            const response = {
                success: true,
                data: { orderId: parseInt(orderId), txHash },
                message: 'Order refunded successfully'
            };
            res.json(response);
        }
        catch (contractError) {
            console.error('Contract refund error:', contractError);
            res.status(500).json({
                success: false,
                error: 'Failed to refund on blockchain'
            });
        }
    }
    catch (error) {
        console.error('Admin refund error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Set admin fee wallet
router.post('/set-fee-wallet', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { error, value } = setFeeWalletSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const { address } = value;
        // Update app setting
        await database_1.default.query(`INSERT INTO app_settings (key, value, updated_by)
       VALUES ('admin_fee_wallet', $1, $2)
       ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`, [address, 1]);
        // Log fee wallet update
        await database_1.default.query('INSERT INTO audit_logs (action, details, ip_address) VALUES ($1, $2, $3)', ['ADMIN_SET_FEE_WALLET', JSON.stringify({ address }), req.ip]);
        const response = {
            success: true,
            message: 'Fee wallet address updated successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Set fee wallet error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get admin support address for support calls
router.get('/support-address', async (req, res) => {
    try {
        // Try to get admin support address from app settings
        const settingResult = await database_1.default.query('SELECT value FROM app_settings WHERE key = $1', ['admin_support_address']);
        let adminAddress;
        if (settingResult.rows.length > 0 && settingResult.rows[0].value) {
            adminAddress = settingResult.rows[0].value;
        }
        else {
            // Use a special admin address constant
            // This can be configured later via admin settings
            adminAddress = process.env.ADMIN_SUPPORT_ADDRESS || 'ADMIN_SUPPORT';
        }
        const response = {
            success: true,
            data: {
                address: adminAddress,
                type: 'admin-support'
            }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get admin support address error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get app settings
router.get('/settings', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM app_settings ORDER BY key ASC');
        // Return array of objects with key and value properties
        const settings = result.rows.map(row => ({
            key: row.key,
            value: row.value,
            description: row.description || undefined
        }));
        const response = {
            success: true,
            data: settings
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update app setting
router.put('/settings/:key', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        if (!value) {
            return res.status(400).json({
                success: false,
                error: 'Value is required'
            });
        }
        const result = await database_1.default.query(`INSERT INTO app_settings (key, value, description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       description = COALESCE(EXCLUDED.description, app_settings.description),
       updated_at = NOW()
       RETURNING *`, [key, value, description || null]);
        const response = {
            success: true,
            data: result.rows[0],
            message: 'Setting updated successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get trading hours settings (public endpoint - no auth required)
router.get('/trading-hours', async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT key, value FROM app_settings 
       WHERE key IN ('trading_buy_enabled', 'trading_sell_enabled', 'trading_start_time', 'trading_end_time')`);
        const settings = {
            buyEnabled: true,
            sellEnabled: true,
            startTime: '09:00',
            endTime: '18:00'
        };
        result.rows.forEach((row) => {
            if (row.key === 'trading_buy_enabled') {
                settings.buyEnabled = row.value === 'true';
            }
            else if (row.key === 'trading_sell_enabled') {
                settings.sellEnabled = row.value === 'true';
            }
            else if (row.key === 'trading_start_time') {
                settings.startTime = row.value;
            }
            else if (row.key === 'trading_end_time') {
                settings.endTime = row.value;
            }
        });
        const response = {
            success: true,
            data: settings
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get trading hours error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update trading hours settings (admin only)
router.put('/trading-hours', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { buyEnabled, sellEnabled, startTime, endTime } = req.body;
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (startTime && !timeRegex.test(startTime)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid start time format. Use HH:MM (24-hour format)'
            });
        }
        if (endTime && !timeRegex.test(endTime)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid end time format. Use HH:MM (24-hour format)'
            });
        }
        // Update settings
        const updates = [];
        if (buyEnabled !== undefined) {
            await database_1.default.query(`INSERT INTO app_settings (key, value, updated_at)
         VALUES ('trading_buy_enabled', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [buyEnabled.toString()]);
            updates.push('buyEnabled');
        }
        if (sellEnabled !== undefined) {
            await database_1.default.query(`INSERT INTO app_settings (key, value, updated_at)
         VALUES ('trading_sell_enabled', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [sellEnabled.toString()]);
            updates.push('sellEnabled');
        }
        if (startTime) {
            await database_1.default.query(`INSERT INTO app_settings (key, value, updated_at)
         VALUES ('trading_start_time', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [startTime]);
            updates.push('startTime');
        }
        if (endTime) {
            await database_1.default.query(`INSERT INTO app_settings (key, value, updated_at)
         VALUES ('trading_end_time', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [endTime]);
            updates.push('endTime');
        }
        // Log update
        await database_1.default.query('INSERT INTO audit_logs (action, details, ip_address) VALUES ($1, $2, $3)', ['ADMIN_UPDATE_TRADING_HOURS', JSON.stringify({ buyEnabled, sellEnabled, startTime, endTime }), req.ip]);
        const response = {
            success: true,
            message: `Trading hours updated: ${updates.join(', ')}`
        };
        res.json(response);
    }
    catch (error) {
        console.error('Update trading hours error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get admin dashboard stats
router.get('/dashboard', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const [totalUsersResult, verifiedUsersResult, totalAgentsResult, verifiedAgentsResult, totalAdsResult, activeAdsResult, totalOrdersResult, completedOrdersResult] = await Promise.all([
            database_1.default.query('SELECT COUNT(*) as count FROM users'),
            database_1.default.query('SELECT COUNT(*) as count FROM users WHERE verified = true'),
            database_1.default.query('SELECT COUNT(*) as count FROM agents'),
            database_1.default.query('SELECT COUNT(*) as count FROM agents WHERE verified = true'),
            database_1.default.query('SELECT COUNT(*) as count FROM ads'),
            database_1.default.query('SELECT COUNT(*) as count FROM ads WHERE active = true'),
            database_1.default.query('SELECT COUNT(*) as count FROM orders'),
            database_1.default.query('SELECT COUNT(*) as count FROM orders WHERE state = \'RELEASED\'')
        ]);
        const stats = {
            users: {
                total: parseInt(totalUsersResult.rows[0].count),
                verified: parseInt(verifiedUsersResult.rows[0].count)
            },
            agents: {
                total: parseInt(totalAgentsResult.rows[0].count),
                verified: parseInt(verifiedAgentsResult.rows[0].count)
            },
            ads: {
                total: parseInt(totalAdsResult.rows[0].count),
                active: parseInt(activeAdsResult.rows[0].count)
            },
            orders: {
                total: parseInt(totalOrdersResult.rows[0].count),
                completed: parseInt(completedOrdersResult.rows[0].count)
            }
        };
        const response = {
            success: true,
            data: stats
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get all locations (Admin)
router.get('/locations', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { city, state, country, limit = 400, offset = 0 } = req.query;
        let query = `
      SELECT l.*, 
             COUNT(ag.id) as agent_count,
             COUNT(CASE WHEN ag.verified = true THEN 1 END) as verified_agents
      FROM locations l
      LEFT JOIN agents ag ON l.id = ag.location_id
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (city) {
            query += ` AND l.city ILIKE $${paramIndex}`;
            queryParams.push(`%${city}%`);
            paramIndex++;
        }
        if (state) {
            query += ` AND l.state ILIKE $${paramIndex}`;
            queryParams.push(`%${state}%`);
            paramIndex++;
        }
        if (country) {
            query += ` AND l.country ILIKE $${paramIndex}`;
            queryParams.push(`%${country}%`);
            paramIndex++;
        }
        query += ` GROUP BY l.id ORDER BY l.city ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        const response = {
            success: true,
            data: result.rows
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get admin locations error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Create location (Admin)
router.post('/locations', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { name, city, state, country, active = true } = req.body;
        if (!name || !city || !state || !country) {
            return res.status(400).json({
                success: false,
                error: 'Name, city, state, and country are required'
            });
        }
        const result = await database_1.default.query('INSERT INTO locations (name, city, state, country, active) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, city, state, country, active]);
        const response = {
            success: true,
            data: result.rows[0]
        };
        res.status(201).json(response);
    }
    catch (error) {
        console.error('Create location error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update location (Admin)
router.put('/locations/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, city, state, country, active } = req.body;
        if (!name || !city || !state || !country) {
            return res.status(400).json({
                success: false,
                error: 'Name, city, state, and country are required'
            });
        }
        const result = await database_1.default.query('UPDATE locations SET name = $1, city = $2, state = $3, country = $4, active = $5 WHERE id = $6 RETURNING *', [name, city, state, country, active, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Location not found'
            });
        }
        const response = {
            success: true,
            data: result.rows[0]
        };
        res.json(response);
    }
    catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Delete location (Admin)
router.delete('/locations/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Check if location has agents
        const agentsResult = await database_1.default.query('SELECT COUNT(*) as count FROM agents WHERE location_id = $1', [id]);
        if (parseInt(agentsResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete location with associated agents'
            });
        }
        const result = await database_1.default.query('DELETE FROM locations WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Location not found'
            });
        }
        const response = {
            success: true,
            data: { message: 'Location deleted successfully' }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Delete location error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Create agent (Admin)
router.post('/agents', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { branch_name, mobile, address, location_id, verified = false } = req.body;
        if (!branch_name || !mobile || !address || !location_id) {
            return res.status(400).json({
                success: false,
                error: 'Branch name, mobile, address, and location are required'
            });
        }
        const result = await database_1.default.query('INSERT INTO agents (branch_name, mobile, address, location_id, verified, created_by_admin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [branch_name, mobile, address, location_id, verified, 1]);
        const response = {
            success: true,
            data: result.rows[0]
        };
        res.status(201).json(response);
    }
    catch (error) {
        console.error('Create agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update agent (Admin)
router.put('/agents/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { branch_name, mobile, address, location_id, verified } = req.body;
        if (!branch_name || !mobile || !address || !location_id) {
            return res.status(400).json({
                success: false,
                error: 'Branch name, mobile, address, and location are required'
            });
        }
        const result = await database_1.default.query('UPDATE agents SET branch_name = $1, mobile = $2, address = $3, location_id = $4, verified = $5 WHERE id = $6 RETURNING *', [branch_name, mobile, address, location_id, verified, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        const response = {
            success: true,
            data: result.rows[0]
        };
        res.json(response);
    }
    catch (error) {
        console.error('Update agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Delete agent (Admin)
router.delete('/agents/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query('DELETE FROM agents WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }
        const response = {
            success: true,
            data: { message: 'Agent deleted successfully' }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Delete agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get all transactions (Admin)
router.get('/transactions', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { status, type, token, limit = 100, offset = 0 } = req.query;
        let query = `
      SELECT t.*, o.amount, o.token, o.state as order_state, o.created_at as order_created_at,
             o.accepted_at, o.lock_expires_at, o.tx_hash, o.blockchain_trade_id,
             a.type as ad_type, a.price_inr, a.min_amount, a.max_amount,
             bu.name as buyer_name, bu.phone as buyer_mobile,
             su.name as seller_name, su.phone as seller_mobile,
             ag.branch_name as agent_branch, ag.mobile as agent_mobile, ag.address as agent_address,
             l.city as location_city, l.state as location_state, l.country as location_country
      FROM transactions t
      JOIN orders o ON t.order_id = o.id
      JOIN ads a ON o.ad_id = a.id
      LEFT JOIN users bu ON o.buyer_address = bu.address
      LEFT JOIN users su ON o.seller_address = su.address
      LEFT JOIN agents ag ON o.agent_branch = ag.branch_name
      LEFT JOIN locations l ON ag.location_id = l.id
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (status) {
            query += ` AND t.status = $${paramIndex}`;
            queryParams.push(status);
            paramIndex++;
        }
        if (type) {
            query += ` AND t.transaction_type = $${paramIndex}`;
            queryParams.push(type);
            paramIndex++;
        }
        if (token) {
            query += ` AND t.token = $${paramIndex}`;
            queryParams.push(token);
            paramIndex++;
        }
        query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, offset);
        const result = await database_1.default.query(query, queryParams);
        const response = {
            success: true,
            data: result.rows
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get admin transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
