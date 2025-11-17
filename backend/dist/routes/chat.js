"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const joi_1 = __importDefault(require("joi"));
const router = express_1.default.Router();
// Get chat messages for a user
router.get('/messages', auth_1.authenticateToken, async (req, res) => {
    try {
        const userAddress = req.user.address;
        const result = await database_1.default.query(`SELECT 
        cm.*,
        u.name as user_name,
        au.username as admin_username
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_address = u.address
      LEFT JOIN admin_users au ON cm.admin_id = au.id
      WHERE cm.user_address = $1
      ORDER BY cm.created_at ASC`, [userAddress.toLowerCase()]);
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Send a message (user to admin)
router.post('/send', auth_1.authenticateToken, async (req, res) => {
    try {
        const schema = joi_1.default.object({
            message: joi_1.default.string().required().max(1000)
        });
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const userAddress = req.user.address;
        const { message } = value;
        const result = await database_1.default.query(`INSERT INTO chat_messages (user_address, message, sender_type, is_read)
       VALUES ($1, $2, 'user', false)
       RETURNING *`, [userAddress.toLowerCase(), message]);
        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Message sent successfully'
        });
    }
    catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Mark messages as read
router.post('/mark-read', auth_1.authenticateToken, async (req, res) => {
    try {
        const userAddress = req.user.address;
        await database_1.default.query(`UPDATE chat_messages 
       SET is_read = true 
       WHERE user_address = $1 AND sender_type = 'admin' AND is_read = false`, [userAddress.toLowerCase()]);
        res.json({
            success: true,
            message: 'Messages marked as read'
        });
    }
    catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get unread message count
router.get('/unread-count', auth_1.authenticateToken, async (req, res) => {
    try {
        const userAddress = req.user.address;
        const result = await database_1.default.query(`SELECT COUNT(*) as count 
       FROM chat_messages 
       WHERE user_address = $1 AND sender_type = 'admin' AND is_read = false`, [userAddress.toLowerCase()]);
        res.json({
            success: true,
            data: {
                unread_count: parseInt(result.rows[0].count)
            }
        });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
