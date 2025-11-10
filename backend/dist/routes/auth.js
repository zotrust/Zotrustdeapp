"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const database_1 = __importDefault(require("../config/database"));
console.log(bcryptjs_1.default.hashSync('admin123', 10));
const router = express_1.default.Router();
// Wallet-based authentication
router.post('/wallet-login', async (req, res) => {
    try {
        const { address, signature, message } = req.body;
        if (!address || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Address, signature, and message are required'
            });
        }
        // Verify signature
        const isValidSignature = (0, auth_1.verifyWalletSignature)(message, signature, address);
        if (!isValidSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid signature'
            });
        }
        // Upsert user by unique address to avoid duplicates and PK conflicts
        await database_1.default.query(`INSERT INTO users (address) VALUES ($1)
       ON CONFLICT (address) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`, [address.toLowerCase()]);
        const userResult = await database_1.default.query('SELECT * FROM users WHERE address = $1', [address.toLowerCase()]);
        const user = userResult.rows[0];
        const token = (0, auth_1.generateAuthToken)(address.toLowerCase());
        // Log authentication
        await database_1.default.query('INSERT INTO audit_logs (user_address, action, ip_address) VALUES ($1, $2, $3)', [address.toLowerCase(), 'WALLET_LOGIN', req.ip]);
        const response = {
            success: true,
            data: {
                user,
                token
            }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Wallet login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Admin login
router.post('/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }
        // Get admin user
        const adminResult = await database_1.default.query('SELECT * FROM admin_users WHERE username = $1', [username]);
        if (adminResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        const admin = adminResult.rows[0];
        const isValidPassword = await bcryptjs_1.default.compare(password, admin.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        const token = (0, auth_1.generateAdminToken)(username);
        // Log admin login
        await database_1.default.query('INSERT INTO audit_logs (action, details, ip_address) VALUES ($1, $2, $3)', ['ADMIN_LOGIN', JSON.stringify({ username }), req.ip]);
        const response = {
            success: true,
            data: {
                admin: {
                    id: admin.id,
                    username: admin.username,
                    role: admin.role
                },
                token
            }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get current user
router.get('/me', auth_1.authenticateToken, async (req, res) => {
    try {
        const response = {
            success: true,
            data: req.user
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get user by address (public endpoint for wallet disconnect scenario)
router.get('/user-by-address', async (req, res) => {
    try {
        const { address } = req.query;
        if (!address || typeof address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Address parameter is required'
            });
        }
        const result = await database_1.default.query('SELECT * FROM users WHERE address = $1', [address.toLowerCase()]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        const user = result.rows[0];
        const response = {
            success: true,
            data: user
        };
        res.json(response);
    }
    catch (error) {
        console.error('Get user by address error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Logout (client-side token removal)
router.post('/logout', auth_1.authenticateToken, async (req, res) => {
    try {
        // Log logout
        await database_1.default.query('INSERT INTO audit_logs (user_address, action, ip_address) VALUES ($1, $2, $3)', [req.user.address, 'LOGOUT', req.ip]);
        const response = {
            success: true,
            message: 'Logged out successfully'
        };
        res.json(response);
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Get all users (for review selection)
router.get('/users', auth_1.authenticateToken, async (req, res) => {
    try {
        const result = await database_1.default.query(`
      SELECT address, name, created_at
      FROM users 
      ORDER BY created_at DESC
    `);
        res.json({
            success: true,
            data: result.rows
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
exports.default = router;
