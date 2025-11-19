/**
 * Insert Sample Reviews Script with Indian Names and Random Wallet Addresses
 * 
 * This script:
 * 1. Generates random wallet addresses for each user
 * 2. Creates users with Indian names
 * 3. Inserts 30+ reviews with different dates
 * 
 * Usage: npm run insert-reviews
 */

import fs from 'fs';
import path from 'path';
import pool from '../src/config/database';
import { createHash } from 'crypto';

interface Review {
  id: number;
  reviewer_address: string;
  reviewer_name: string;
  reviewee_address: string;
  reviewee_name: string;
  order_id: number | null;
  rating: number;
  message: string;
  created_at: Date;
}

const csvPath = path.join(__dirname, '../src/routes/revei.csv');
const platformAddress = '0x' + '9'.repeat(40);
const platformName = 'Zotrust Platform Desk';
const adminUserId = 1;

const fourStarIds = new Set<number>([
  42, 46, 50, 54, 57, 59, 60, 63, 64, 67, 68, 70, 72, 77, 81, 85, 89, 92, 94, 95,
  98, 99, 102, 103, 105, 107, 115, 118, 122, 126, 130, 134
]);

const indianFirstNames = [
  'Aarav', 'Vihaan', 'Aditya', 'Vivaan', 'Ayaan', 'Krishna', 'Ishaan', 'Kabir',
  'Rudra', 'Arjun', 'Yuvan', 'Kiaan', 'Atharv', 'Pranav', 'Harsh', 'Kunal',
  'Manan', 'Devansh', 'Arnav', 'Parth', 'Yash', 'Om', 'Samar', 'Tanish',
  'Lakshya', 'Ayan', 'Shivansh', 'Jai', 'Aryan', 'Vikram', 'Raghav', 'Utsav',
  'Vedant', 'Ansh', 'Hriday', 'Nishit', 'Dhruv', 'Sahil', 'Tarun', 'Aniket',
  'Ritesh', 'Madhav', 'Kabya', 'Siddharth', 'Shaurya', 'Keshav', 'Arnav', 'Reyansh'
];

const indianLastNames = [
  'Patel', 'Sharma', 'Singh', 'Mehta', 'Reddy', 'Das', 'Iyer', 'Menon', 'Jain',
  'Shah', 'Garg', 'Kapoor', 'Khan', 'Srivastava', 'Desai', 'Bhatt', 'Chopra',
  'Kulkarni', 'Naidu', 'Basu', 'Ghosh', 'Verma', 'Joshi', 'Agarwal', 'Bhandari',
  'Chaudhary', 'Trivedi', 'Malhotra', 'Nair', 'Yadav', 'Shetty', 'Gupta',
  'Bose', 'Parikh', 'Dutta', 'Bose', 'Nanda', 'Sethi', 'Saxena', 'Thakkar',
  'Chhabra', 'Sarin', 'Kamat', 'Tiwari', 'Nigam', 'Dubey', 'Pathak', 'Bansal'
];

// Indian Cities
const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Ahmedabad', 'Pune', 'Surat', 'Jaipur',
  'Chennai', 'Hyderabad', 'Kolkata', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad'
];

function generateDeterministicAddress(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return `0x${hex.slice(0, 40)}`;
}

function generateIndianName(index: number): string {
  const first = indianFirstNames[index % indianFirstNames.length];
  const last = indianLastNames[Math.floor(index / indianFirstNames.length) % indianLastNames.length];
  return `${first} ${last}`;
}

function sanitizeMessage(raw: string): string {
  let message = raw.trim();
  if (message.startsWith('"') && message.endsWith('"')) {
    message = message.slice(1, -1).replace(/""/g, '"');
  }
  return message;
}

function buildReviewsFromCsv(): Review[] {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = lines.slice(1); // skip header

  const now = Date.now();
  const reviews: Review[] = rows.map((line, idx) => {
    const match = line.match(/^(\d+),(.*)$/);
    if (!match) {
      throw new Error(`Invalid CSV row: ${line}`);
    }
    const id = Number(match[1]);
    const message = sanitizeMessage(match[2]);
    const rating = fourStarIds.has(id) ? 4 : 5;
    const created_at = new Date(now - (rows.length - idx) * 36 * 60 * 60 * 1000);

    return {
      id,
      reviewer_address: generateDeterministicAddress(`reviewer-${id}`),
      reviewer_name: generateIndianName(idx),
      reviewee_address: platformAddress,
      reviewee_name: platformName,
    order_id: null,
      rating,
      message,
      created_at
    };
  });

  return reviews;
}

async function insertSampleReviews() {
  try {
    console.log('🚀 Starting sample reviews insertion with Indian names and random addresses...\n');

    const adminId = 1; // Default admin ID
    const createdUsers = new Map<string, { address: string; name: string }>();
    let userInsertedCount = 0;
    let reviewInsertedCount = 0;

    // Step 1: Create users with random addresses and Indian names
    console.log('📝 Step 1: Creating users with Indian names...\n');

    // Generate unique addresses for all reviewers and reviewees
    const allAddresses = new Set<string>();
    for (let i = 0; i < reviews.length * 2; i++) {
      let address: string;
      do {
        address = generateRandomAddress();
      } while (allAddresses.has(address.toLowerCase()));
      allAddresses.add(address.toLowerCase());
    }

    const addressArray = Array.from(allAddresses);
    let nameIndex = 0;

    // Assign addresses and names to reviews
    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];
      
      // Assign reviewer
      review.reviewer_address = addressArray[i * 2];
      review.reviewer_name = indianNames[nameIndex % indianNames.length];
      nameIndex++;
      
      // Assign reviewee (different from reviewer)
      review.reviewee_address = addressArray[i * 2 + 1];
      review.reviewee_name = indianNames[nameIndex % indianNames.length];
      nameIndex++;

      // Create reviewer user if not exists
      if (!createdUsers.has(review.reviewer_address.toLowerCase())) {
        const city = indianCities[Math.floor(Math.random() * indianCities.length)];
        const phone = `9${Math.floor(Math.random() * 9000000000) + 1000000000}`; // 10-digit Indian phone
        
        try {
          await pool.query(
            `INSERT INTO users (address, name, phone, city, verified, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (address) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at`,
            [
              review.reviewer_address.toLowerCase(),
              review.reviewer_name,
              phone,
              city,
              true,
              review.created_at,
              review.created_at
            ]
          );
          createdUsers.set(review.reviewer_address.toLowerCase(), {
            address: review.reviewer_address,
            name: review.reviewer_name
          });
          userInsertedCount++;
          console.log(`✅ Created user: ${review.reviewer_name} (${review.reviewer_address.substring(0, 10)}...)`);
        } catch (error: any) {
          if (error.code !== '23505') { // Ignore duplicate key errors
            console.error(`⚠️  Error creating reviewer user: ${error.message}`);
          }
        }
      }

      // Create reviewee user if not exists
      if (!createdUsers.has(review.reviewee_address.toLowerCase())) {
        const city = indianCities[Math.floor(Math.random() * indianCities.length)];
        const phone = `9${Math.floor(Math.random() * 9000000000) + 1000000000}`;
        
        try {
          await pool.query(
            `INSERT INTO users (address, name, phone, city, verified, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (address) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at`,
            [
              review.reviewee_address.toLowerCase(),
              review.reviewee_name,
              phone,
              city,
              true,
              review.created_at,
              review.created_at
            ]
          );
          createdUsers.set(review.reviewee_address.toLowerCase(), {
            address: review.reviewee_address,
            name: review.reviewee_name
          });
          userInsertedCount++;
          console.log(`✅ Created user: ${review.reviewee_name} (${review.reviewee_address.substring(0, 10)}...)`);
        } catch (error: any) {
          if (error.code !== '23505') {
            console.error(`⚠️  Error creating reviewee user: ${error.message}`);
          }
        }
      }
    }

    console.log(`\n✨ Created ${userInsertedCount} users\n`);

    // Step 2: Insert reviews
    console.log('📝 Step 2: Inserting reviews...\n');

    for (let i = 0; i < reviews.length; i++) {
      const review = reviews[i];

      // Check if review already exists
      const existingReview = await pool.query(
        `SELECT id FROM reviews 
         WHERE LOWER(reviewer_address) = LOWER($1) 
         AND LOWER(reviewee_address) = LOWER($2) 
         AND message = $3`,
        [review.reviewer_address, review.reviewee_address, review.message]
      );

      if (existingReview.rows.length > 0) {
        console.log(`⏭️  Skipping duplicate review ${i + 1}: "${review.message.substring(0, 50)}..."`);
        continue;
      }

      // Insert review
      const result = await pool.query(
        `INSERT INTO reviews (
          reviewer_address,
          reviewee_address,
          order_id,
          rating,
          message,
          is_visible,
          is_approved,
          created_at,
          updated_at,
          approved_by,
          approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          review.reviewer_address.toLowerCase(),
          review.reviewee_address.toLowerCase(),
          review.order_id,
          review.rating,
          review.message,
          true, // is_visible
          true, // is_approved
          review.created_at,
          review.created_at,
          adminId,
          review.created_at
        ]
      );

      reviewInsertedCount++;
      console.log(`✅ Review ${i + 1}/${reviews.length}: ${review.reviewer_name} → ${review.reviewee_name} (Rating: ${review.rating}/5)`);
      console.log(`   "${review.message.substring(0, 60)}..." (ID: ${result.rows[0].id})`);
    }

    console.log(`\n✨ Successfully inserted ${reviewInsertedCount} reviews!`);

    // Show summary
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star
       FROM reviews 
       WHERE is_approved = true AND is_visible = true`
    );

    const stats = statsResult.rows[0];
    console.log(`\n📈 Review Statistics:`);
    console.log(`   Total Approved Reviews: ${stats.total}`);
    console.log(`   Average Rating: ${parseFloat(stats.avg_rating || 0).toFixed(2)}`);
    console.log(`   5-Star Reviews: ${stats.five_star}`);
    console.log(`   4-Star Reviews: ${stats.four_star}`);
    console.log(`\n👥 Users Created: ${userInsertedCount}`);
    console.log(`📝 Reviews Inserted: ${reviewInsertedCount}`);

  } catch (error) {
    console.error('❌ Error inserting reviews:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the script
if (require.main === module) {
  insertSampleReviews()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export default insertSampleReviews;
