"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAdminToken = exports.generateAuthToken = exports.verifyWalletSignature = exports.authenticateAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ethers_1 = require("ethers");
const database_1 = __importDefault(require("../config/database"));
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'Access token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024');
        // Get user from database
        const userResult = await database_1.default.query('SELECT * FROM users WHERE address = $1', [decoded.address]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }
        req.user = userResult.rows[0];
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
};
exports.authenticateToken = authenticateToken;
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, error: 'Admin access token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024');
        // console.log('Admin auth - Decoded token:', decoded);
        if (decoded.role !== 'admin') {
            // console.log('Admin auth - Role check failed. Expected: admin, Got:', decoded.role);
            return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        next();
    }
    catch (error) {
        // console.error('Admin auth - Error:', error);
        return res.status(403).json({ success: false, error: 'Invalid admin token' });
    }
};
exports.authenticateAdmin = authenticateAdmin;
const verifyWalletSignature = (message, signature, address) => {
    try {
        const recoveredAddress = ethers_1.ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
    }
    catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};
exports.verifyWalletSignature = verifyWalletSignature;
const generateAuthToken = (address) => {
    return jsonwebtoken_1.default.sign({ address }, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024', { expiresIn: '7d' });
};
exports.generateAuthToken = generateAuthToken;
const generateAdminToken = (username) => {
    return jsonwebtoken_1.default.sign({ username, role: 'admin' }, process.env.JWT_SECRET || 'zotrust-admin-secret-key-2024', { expiresIn: '24h' });
};
exports.generateAdminToken = generateAdminToken;
