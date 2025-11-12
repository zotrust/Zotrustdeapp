/**
 * Delete Reviews from Database Script
 * 
 * This script deletes reviews from the database
 * You can specify how many reviews to delete (default: 14)
 * 
 * Usage: npx ts-node backend/scripts/delete-reviews-from-db.ts [count]
 * Example: npx ts-node backend/scripts/delete-reviews-from-db.ts 14
 */

import pool from '../src/config/database';

async function deleteReviewsFromDB(count: number = 14) {
  try {
    console.log(`🗑️  Starting to delete ${count} reviews from database...\n`);

    // Get count before deletion
    const countResult = await pool.query('SELECT COUNT(*) as count FROM reviews');
    const countBefore = parseInt(countResult.rows[0].count);
    console.log(`📊 Found ${countBefore} reviews in database\n`);

    if (countBefore === 0) {
      console.log('✅ No reviews to delete. Database is already empty.');
      return;
    }

    if (count > countBefore) {
      console.log(`⚠️  Requested to delete ${count} reviews, but only ${countBefore} exist. Deleting all ${countBefore} reviews.`);
      count = countBefore;
    }

    // Delete reviews (oldest first)
    const deleteResult = await pool.query(
      `DELETE FROM reviews 
       WHERE id IN (
         SELECT id FROM reviews 
         ORDER BY created_at ASC 
         LIMIT $1
       )`,
      [count]
    );

    const deletedCount = deleteResult.rowCount || 0;

    // Get count after deletion
    const countAfterResult = await pool.query('SELECT COUNT(*) as count FROM reviews');
    const countAfter = parseInt(countAfterResult.rows[0].count);

    console.log(`✅ Successfully deleted ${deletedCount} reviews!`);
    console.log(`📊 Reviews before: ${countBefore}`);
    console.log(`📊 Reviews after: ${countAfter}`);
    console.log(`📊 Reviews remaining: ${countAfter}`);

  } catch (error) {
    console.error('❌ Error deleting reviews:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Get count from command line argument
const countArg = process.argv[2];
const count = countArg ? parseInt(countArg) : 14;

if (isNaN(count) || count < 1) {
  console.error('❌ Invalid count. Please provide a positive number.');
  console.log('Usage: npx ts-node backend/scripts/delete-reviews-from-db.ts [count]');
  process.exit(1);
}

// Run the script
if (require.main === module) {
  deleteReviewsFromDB(count)
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default deleteReviewsFromDB;

