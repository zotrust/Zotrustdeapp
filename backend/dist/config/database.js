"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'zotrust',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,
    min: 2, // Keep minimum connections alive
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased from 2000 to 10000
});
// Handle pool errors
exports.pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client:', err);
});
exports.pool.on('connect', (client) => {
    console.log('🔗 New database client connected');
});
exports.pool.on('remove', (client) => {
    console.log('🔌 Database client removed from pool');
});
const connectDB = async () => {
    try {
        const client = await exports.pool.connect();
        console.log('✅ PostgreSQL connected successfully');
        // Ensure SERIAL sequences are aligned with current max(id) to avoid PK conflicts
        const sequenceFixes = [
            "SELECT setval('users_id_seq',       COALESCE((SELECT MAX(id) FROM users), 1))",
            "SELECT setval('agents_id_seq',      COALESCE((SELECT MAX(id) FROM agents), 1))",
            "SELECT setval('ads_id_seq',         COALESCE((SELECT MAX(id) FROM ads), 1))",
            "SELECT setval('orders_id_seq',      COALESCE((SELECT MAX(id) FROM orders), 1))",
            "SELECT setval('otp_logs_id_seq',    COALESCE((SELECT MAX(id) FROM otp_logs), 1))",
            "SELECT setval('admin_users_id_seq', COALESCE((SELECT MAX(id) FROM admin_users), 1))",
            "SELECT setval('calls_id_seq',       COALESCE((SELECT MAX(id) FROM calls), 1))",
            "SELECT setval('audit_logs_id_seq',  COALESCE((SELECT MAX(id) FROM audit_logs), 1))",
            "SELECT setval('app_settings_id_seq',COALESCE((SELECT MAX(id) FROM app_settings), 1))"
        ];
        for (const sql of sequenceFixes) {
            try {
                await client.query(sql);
            }
            catch (e) {
                // Ignore if sequence/table missing; continue
            }
        }
        client.release();
    }
    catch (error) {
        console.error('❌ PostgreSQL connection failed:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
exports.default = exports.pool;
