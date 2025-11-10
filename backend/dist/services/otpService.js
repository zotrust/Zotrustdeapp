"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTPService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../config/database"));
class OTPService {
    static generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    static hashOTP(otp, orderId) {
        const data = `${otp}${orderId}${this.SERVER_SALT}`;
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    }
    static async createOTPForOrder(orderId) {
        const otp = this.generateOTP();
        const otpHash = this.hashOTP(otp, orderId);
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);
        // Store OTP log
        await database_1.default.query(`INSERT INTO otp_logs (order_id, otp_hash, expires_at) 
       VALUES ($1, $2, $3)`, [orderId, otpHash, expiresAt]);
        return { otp, otpHash };
    }
    static async verifyOTP(orderId, otp) {
        try {
            const expectedHash = this.hashOTP(otp, orderId);
            // Check if OTP exists and is not expired
            const result = await database_1.default.query(`SELECT id FROM otp_logs 
         WHERE order_id = $1 AND otp_hash = $2 AND expires_at > NOW() AND used = false`, [orderId, expectedHash]);
            if (result.rows.length === 0) {
                return false;
            }
            // Mark OTP as used
            await database_1.default.query(`UPDATE otp_logs SET used = true WHERE id = $1`, [result.rows[0].id]);
            return true;
        }
        catch (error) {
            console.error('OTP verification error:', error);
            return false;
        }
    }
    static async getOTPHashFromContract(orderId) {
        try {
            // Get OTP hash from order record (stored when seller accepts)
            const result = await database_1.default.query('SELECT otp_hash FROM orders WHERE id = $1', [orderId]);
            return result.rows.length > 0 ? result.rows[0].otp_hash : null;
        }
        catch (error) {
            console.error('Error getting OTP hash:', error);
            return null;
        }
    }
    static async cleanupExpiredOTPs() {
        try {
            await database_1.default.query('DELETE FROM otp_logs WHERE expires_at < NOW()');
        }
        catch (error) {
            console.error('Error cleaning up expired OTPs:', error);
        }
    }
}
exports.OTPService = OTPService;
OTPService.OTP_LENGTH = 6;
OTPService.OTP_EXPIRY_MINUTES = 10;
OTPService.SERVER_SALT = process.env.OTP_SALT || 'zotrust-default-salt';
