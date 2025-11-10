"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const router = express_1.default.Router();
// Get all support contacts
router.get('/', async (req, res) => {
    try {
        console.log('📞 SUPPORT: Fetching support contacts');
        const result = await database_1.pool.query('SELECT * FROM support WHERE active = true ORDER BY priority ASC, created_at ASC');
        const supportContacts = result.rows.map(row => ({
            id: row.id,
            type: row.type,
            value: row.value,
            label: row.label,
            active: row.active,
            priority: row.priority,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
        console.log('✅ SUPPORT: Found', supportContacts.length, 'support contacts');
        const response = {
            success: true,
            data: supportContacts
        };
        res.json(response);
    }
    catch (error) {
        console.error('❌ SUPPORT: Error fetching support contacts:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get support contacts by type
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        if (!['phone', 'email'].includes(type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid support type. Must be phone or email'
            });
        }
        console.log('📞 SUPPORT: Fetching', type, 'contacts');
        const result = await database_1.pool.query('SELECT * FROM support WHERE type = $1 AND active = true ORDER BY priority ASC, created_at ASC', [type]);
        const supportContacts = result.rows.map(row => ({
            id: row.id,
            type: row.type,
            value: row.value,
            label: row.label,
            active: row.active,
            priority: row.priority,
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
        console.log('✅ SUPPORT: Found', supportContacts.length, type, 'contacts');
        const response = {
            success: true,
            data: supportContacts
        };
        res.json(response);
    }
    catch (error) {
        console.error('❌ SUPPORT: Error fetching support contacts by type:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
