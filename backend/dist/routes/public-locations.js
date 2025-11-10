"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const router = express_1.default.Router();
// Get all locations (public endpoint)
router.get('/', async (req, res) => {
    try {
        const result = await database_1.pool.query(`
      SELECT id, name, created_at
      FROM locations
      ORDER BY name ASC
    `);
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('Get locations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch locations'
        });
    }
});
exports.default = router;
