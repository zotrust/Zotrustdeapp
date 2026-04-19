"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get all users (Admin)
router.get('/', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { search, verified, blocked, limit = 50, offset = 0 } = req.query;
        let query = `
      SELECT 
        u.id,
        u.address,
        u.name,
        u.phone,
        u.city,
        u.location_id,
        u.verified,
        u.verified_at,
        u.is_blocked,
        u.blocked_at,
        u.blocked_reason,
        u.created_at,
        u.updated_at,
        l.name as location_name,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.state = 'COMPLETED' THEN o.id END) as completed_orders
      FROM users u
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN orders o ON LOWER(o.buyer_address) = LOWER(u.address) OR LOWER(o.seller_address) = LOWER(u.address)
      WHERE 1=1
    `;
        const queryParams = [];
        let paramIndex = 1;
        if (search) {
            query += ` AND (
        LOWER(u.address) LIKE LOWER($${paramIndex}) OR
        LOWER(u.name) LIKE LOWER($${paramIndex}) OR
        LOWER(u.phone) LIKE LOWER($${paramIndex}) OR
        LOWER(u.city) LIKE LOWER($${paramIndex})
      )`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (verified !== undefined) {
            query += ` AND u.verified = $${paramIndex}`;
            queryParams.push(verified === 'true');
            paramIndex++;
        }
        if (blocked !== undefined) {
            query += ` AND COALESCE(u.is_blocked, false) = $${paramIndex}`;
            queryParams.push(blocked === 'true');
            paramIndex++;
        }
        query += ` GROUP BY u.id, l.name`;
        query += ` ORDER BY u.created_at DESC`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(parseInt(limit), parseInt(offset));
        const result = await database_1.default.query(query, queryParams);
        // Get total count for pagination
        let countQuery = `SELECT COUNT(DISTINCT u.id) as total FROM users u WHERE 1=1`;
        const countParams = [];
        let countParamIndex = 1;
        if (search) {
            countQuery += ` AND (
        LOWER(u.address) LIKE LOWER($${countParamIndex}) OR
        LOWER(u.name) LIKE LOWER($${countParamIndex}) OR
        LOWER(u.phone) LIKE LOWER($${countParamIndex}) OR
        LOWER(u.city) LIKE LOWER($${countParamIndex})
      )`;
            countParams.push(`%${search}%`);
            countParamIndex++;
        }
        if (verified !== undefined) {
            countQuery += ` AND u.verified = $${countParamIndex}`;
            countParams.push(verified === 'true');
            countParamIndex++;
        }
        if (blocked !== undefined) {
            countQuery += ` AND COALESCE(u.is_blocked, false) = $${countParamIndex}`;
            countParams.push(blocked === 'true');
            countParamIndex++;
        }
        const countResult = await database_1.default.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < total
            }
        });
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get user by ID (Admin)
router.get('/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await database_1.default.query(`SELECT 
        u.*,
        l.name as location_name,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.state = 'COMPLETED' THEN o.id END) as completed_orders
      FROM users u
      LEFT JOIN locations l ON u.location_id = l.id
      LEFT JOIN orders o ON LOWER(o.buyer_address) = LOWER(u.address) OR LOWER(o.seller_address) = LOWER(u.address)
      WHERE u.id = $1
      GROUP BY u.id, l.name`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        res.json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Approve/Verify user (Admin)
router.put('/:id/verify', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { verified } = req.body;
        if (typeof verified !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'verified must be a boolean'
            });
        }
        let query;
        let params;
        if (verified) {
            query = `UPDATE users 
               SET verified = $1, 
                   verified_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`;
            params = [verified, id];
        }
        else {
            query = `UPDATE users 
               SET verified = $1, 
                   verified_at = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`;
            params = [verified, id];
        }
        const result = await database_1.default.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        res.json({
            success: true,
            data: result.rows[0],
            message: `User ${verified ? 'verified' : 'unverified'} successfully`
        });
    }
    catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Block/Unblock user (Admin)
router.put('/:id/block', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_blocked, blocked_reason } = req.body;
        if (typeof is_blocked !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'is_blocked must be a boolean'
            });
        }
        let query;
        let params;
        if (is_blocked) {
            query = `UPDATE users 
               SET is_blocked = $1, 
                   blocked_at = CURRENT_TIMESTAMP,
                   blocked_reason = $2,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $3
               RETURNING *`;
            params = [is_blocked, blocked_reason || null, id];
        }
        else {
            query = `UPDATE users 
               SET is_blocked = $1, 
                   blocked_at = NULL,
                   blocked_reason = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`;
            params = [is_blocked, id];
        }
        const result = await database_1.default.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        res.json({
            success: true,
            data: result.rows[0],
            message: `User ${is_blocked ? 'blocked' : 'unblocked'} successfully`
        });
    }
    catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Update user (Admin)
router.put('/:id', auth_1.authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, city, location_id } = req.body;
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            values.push(name);
            paramIndex++;
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex}`);
            values.push(phone);
            paramIndex++;
        }
        if (city !== undefined) {
            updates.push(`city = $${paramIndex}`);
            values.push(city);
            paramIndex++;
        }
        if (location_id !== undefined) {
            if (location_id === null || location_id === '') {
                updates.push(`location_id = NULL`);
            }
            else {
                updates.push(`location_id = $${paramIndex}`);
                values.push(parseInt(location_id));
                paramIndex++;
            }
        }
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        const result = await database_1.default.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        res.json({
            success: true,
            data: result.rows[0],
            message: 'User updated successfully'
        });
    }
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
