"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const router = express_1.default.Router();
// Get agents by location
router.get('/', async (req, res) => {
    try {
        const { location_id } = req.query;
        let query = `
      SELECT a.*, l.name as location_name
      FROM agents a
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.verified = true
    `;
        const queryParams = [];
        if (location_id) {
            query += ' AND a.location_id = $1';
            queryParams.push(location_id);
        }
        query += ' ORDER BY a.branch_name ASC';
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
// Get agent details
router.get('/:id', async (req, res) => {
    try {
        const agentId = req.params.id;
        const result = await database_1.default.query('SELECT * FROM agents WHERE id = $1 AND verified = true', [agentId]);
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
        console.error('Get agent error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get cities with agents
router.get('/cities/list', async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT DISTINCT city FROM agents WHERE verified = true ORDER BY city ASC');
        const cities = result.rows.map(row => row.city);
        const response = {
            success: true,
            data: cities
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get cities error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
exports.default = router;
