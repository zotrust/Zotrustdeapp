"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
/**
 * Reset all appeals and disputes to PENDING status for testing
 * This script resets:
 * - disputes.status to 'PENDING'
 * - Clears resolution fields
 * - appeals.status to 'PENDING'
 */
async function resetAppealsToPending() {
    try {
        console.log('🔄 Starting reset of appeals and disputes to PENDING status...\n');
        // Step 1: Get current counts
        const beforeDisputes = await database_1.default.query(`
      SELECT status, COUNT(*) as count 
      FROM disputes 
      GROUP BY status
    `);
        console.log('📊 Current Disputes Status:');
        beforeDisputes.rows.forEach(row => {
            console.log(`   ${row.status}: ${row.count}`);
        });
        const beforeAppeals = await database_1.default.query(`
      SELECT status, COUNT(*) as count 
      FROM appeals 
      GROUP BY status
    `);
        console.log('\n📊 Current Appeals Status:');
        beforeAppeals.rows.forEach(row => {
            console.log(`   ${row.status || 'NULL'}: ${row.count}`);
        });
        // Step 2: Reset disputes to PENDING
        console.log('\n🔄 Resetting disputes to PENDING...');
        const disputesResult = await database_1.default.query(`
      UPDATE disputes 
      SET 
        status = 'PENDING',
        resolution = NULL,
        resolution_reason = NULL,
        resolved_at = NULL,
        resolved_by = NULL
      WHERE status IN ('RESOLVED', 'CLOSED')
      RETURNING id
    `);
        console.log(`✅ Updated ${disputesResult.rowCount} disputes to PENDING`);
        // Step 3: Reset appeals to PENDING
        console.log('\n🔄 Resetting appeals to PENDING...');
        const appealsResult = await database_1.default.query(`
      UPDATE appeals 
      SET status = 'PENDING'
      WHERE status != 'PENDING' OR status IS NULL
      RETURNING id
    `);
        console.log(`✅ Updated ${appealsResult.rowCount} appeals to PENDING`);
        // Step 4: Show final counts
        const afterDisputes = await database_1.default.query(`
      SELECT status, COUNT(*) as count 
      FROM disputes 
      GROUP BY status
    `);
        console.log('\n📊 Final Disputes Status:');
        afterDisputes.rows.forEach(row => {
            console.log(`   ${row.status}: ${row.count}`);
        });
        const afterAppeals = await database_1.default.query(`
      SELECT status, COUNT(*) as count 
      FROM appeals 
      GROUP BY status
    `);
        console.log('\n📊 Final Appeals Status:');
        afterAppeals.rows.forEach(row => {
            console.log(`   ${row.status || 'NULL'}: ${row.count}`);
        });
        console.log('\n✅ Successfully reset all appeals and disputes to PENDING status!');
        console.log('🎯 You can now test the fund release functionality.');
    }
    catch (error) {
        console.error('❌ Error resetting appeals:', error);
        throw error;
    }
    finally {
        await database_1.default.end();
    }
}
// Run the script
resetAppealsToPending()
    .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
});
