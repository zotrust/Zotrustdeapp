
import crypto from 'crypto';
import pool from '../config/database';

export class OTPService {
  private static readonly OTP_LENGTH = 6;
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly SERVER_SALT = process.env.OTP_SALT || 'zotrust-default-salt';

  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static hashOTP(otp: string, orderId: number): string {
    const data = `${otp}${orderId}${this.SERVER_SALT}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static async createOTPForOrder(orderId: number): Promise<{ otp: string; otpHash: string }> {
    const otp = this.generateOTP();
    const otpHash = this.hashOTP(otp, orderId);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Store OTP log
    await pool.query(
      `INSERT INTO otp_logs (order_id, otp_hash, expires_at) 
       VALUES ($1, $2, $3)`,
      [orderId, otpHash, expiresAt]
    );

    return { otp, otpHash };
  }

  static async verifyOTP(orderId: number, otp: string): Promise<boolean> {
    try {
      const expectedHash = this.hashOTP(otp, orderId);
      
      // Check if OTP exists and is not expired
      const result = await pool.query(
        `SELECT id FROM otp_logs 
         WHERE order_id = $1 AND otp_hash = $2 AND expires_at > NOW() AND used = false`,
        [orderId, expectedHash]
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Mark OTP as used
      await pool.query(
        `UPDATE otp_logs SET used = true WHERE id = $1`,
        [result.rows[0].id]
      );

      return true;
    } catch (error) {
      console.error('OTP verification error:', error);
      return false;
    }
  }

  static async getOTPHashFromContract(orderId: number): Promise<string | null> {
    try {
      // Get OTP hash from order record (stored when seller accepts)
      const result = await pool.query(
        'SELECT otp_hash FROM orders WHERE id = $1',
        [orderId]
      );

      return result.rows.length > 0 ? result.rows[0].otp_hash : null;
    } catch (error) {
      console.error('Error getting OTP hash:', error);
      return null;
    }
  }

  static async cleanupExpiredOTPs(): Promise<void> {
    try {
      await pool.query('DELETE FROM otp_logs WHERE expires_at < NOW()');
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }
}
