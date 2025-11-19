/**
 * Update Reviews with Missing Names Script
 * 
 * This script:
 * 1. Finds all reviews where reviewer_name or reviewee_name is null
 * 2. Generates random Indian names for users with missing names
 * 3. Updates the users table with these names
 * 
 * Usage: npx ts-node backend/scripts/update-reviews-with-names.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file from backend directory first, then try root
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

import pool from '../src/config/database';

const indianFirstNames = [
  'Aarav', 'Vihaan', 'Aditya', 'Vivaan', 'Ayaan', 'Krishna', 'Ishaan', 'Kabir',
  'Rudra', 'Arjun', 'Yuvan', 'Kiaan', 'Atharv', 'Pranav', 'Harsh', 'Kunal',
  'Manan', 'Devansh', 'Arnav', 'Parth', 'Yash', 'Om', 'Samar', 'Tanish',
  'Lakshya', 'Ayan', 'Shivansh', 'Jai', 'Aryan', 'Vikram', 'Raghav', 'Utsav',
  'Vedant', 'Ansh', 'Hriday', 'Nishit', 'Dhruv', 'Sahil', 'Tarun', 'Aniket',
  'Ritesh', 'Madhav', 'Kabya', 'Siddharth', 'Shaurya', 'Keshav', 'Reyansh',
  'Priya', 'Ananya', 'Aadhya', 'Diya', 'Ishita', 'Saanvi', 'Anika', 'Pooja',
  'Riya', 'Sneha', 'Kavya', 'Meera', 'Sara', 'Neha', 'Aarohi', 'Avni',
  'Ishani', 'Myra', 'Zara', 'Anvi', 'Aanya', 'Kiara', 'Riya', 'Sia'
];

const indianLastNames = [
  'Patel', 'Sharma', 'Singh', 'Mehta', 'Reddy', 'Das', 'Iyer', 'Menon', 'Jain',
  'Shah', 'Garg', 'Kapoor', 'Khan', 'Srivastava', 'Desai', 'Bhatt', 'Chopra',
  'Kulkarni', 'Naidu', 'Basu', 'Ghosh', 'Verma', 'Joshi', 'Agarwal', 'Bhandari',
  'Chaudhary', 'Trivedi', 'Malhotra', 'Nair', 'Yadav', 'Shetty', 'Gupta',
  'Bose', 'Parikh', 'Dutta', 'Nanda', 'Sethi', 'Saxena', 'Thakkar',
  'Chhabra', 'Sarin', 'Kamat', 'Tiwari', 'Nigam', 'Dubey', 'Pathak', 'Bansal'
];

// Indian Cities
const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Ahmedabad', 'Pune', 'Surat', 'Jaipur',
  'Chennai', 'Hyderabad', 'Kolkata', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad'
];

function generateIndianName(seed: number): string {
  const firstIndex = seed % indianFirstNames.length;
  const lastIndex = Math.floor(seed / indianFirstNames.length) % indianLastNames.length;
  return `${indianFirstNames[firstIndex]} ${indianLastNames[lastIndex]}`;
}

function generatePhoneNumber(seed: number): string {
  // Generate a 10-digit phone number based on seed
  const num = (9000000000 + (seed % 1000000000)).toString();
  return num;
}

async function updateReviewsWithNames() {
  try {
    console.log('🔄 Starting to update reviews with missing names...\n');
    
    // Log database connection info (without password)
    console.log(`📊 Database: ${process.env.DB_NAME || 'zotrust'} on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    console.log(`📊 User: ${process.env.DB_USER || 'postgres'}\n`);

    // Find all reviews where reviewer_name or reviewee_name is null
    const reviewsQuery = `
      SELECT DISTINCT
        r.reviewer_address,
        r.reviewee_address,
        u1.name as reviewer_name,
        u2.name as reviewee_name
      FROM reviews r
      LEFT JOIN users u1 ON LOWER(r.reviewer_address) = LOWER(u1.address)
      LEFT JOIN users u2 ON LOWER(r.reviewee_address) = LOWER(u2.address)
      WHERE u1.name IS NULL OR u2.name IS NULL
    `;

    const reviewsResult = await pool.query(reviewsQuery);
    console.log(`📊 Found ${reviewsResult.rows.length} reviews with missing names\n`);

    if (reviewsResult.rows.length === 0) {
      console.log('✅ All reviews already have names. Nothing to update.');
      await pool.end();
      return;
    }

    // Collect unique addresses that need names
    const addressesToUpdate = new Set<string>();
    const addressNameMap = new Map<string, string>();

    for (const row of reviewsResult.rows) {
      if (!row.reviewer_name && row.reviewer_address) {
        addressesToUpdate.add(row.reviewer_address.toLowerCase());
      }
      if (!row.reviewee_name && row.reviewee_address) {
        addressesToUpdate.add(row.reviewee_address.toLowerCase());
      }
    }

    console.log(`📝 Found ${addressesToUpdate.size} unique addresses that need names\n`);

    // Generate names for each address
    let nameIndex = 0;
    for (const address of addressesToUpdate) {
      // Use address as seed for deterministic name generation
      const seed = parseInt(address.slice(2, 10), 16) || nameIndex;
      const name = generateIndianName(seed);
      addressNameMap.set(address, name);
      nameIndex++;
    }

    // Update users table with generated names
    let updatedCount = 0;
    for (const [address, name] of addressNameMap.entries()) {
      // Check if user exists
      const userCheck = await pool.query(
        'SELECT id, name FROM users WHERE LOWER(address) = LOWER($1)',
        [address]
      );

      if (userCheck.rows.length > 0) {
        // User exists, update name if it's null
        if (!userCheck.rows[0].name) {
          const phone = generatePhoneNumber(parseInt(address.slice(2, 10), 16) || updatedCount);
          const city = indianCities[updatedCount % indianCities.length];

          await pool.query(
            `UPDATE users 
             SET name = $1, 
                 phone = COALESCE(phone, $2),
                 city = COALESCE(city, $3),
                 updated_at = CURRENT_TIMESTAMP
             WHERE LOWER(address) = LOWER($4)`,
            [name, phone, city, address]
          );
          updatedCount++;
          console.log(`✅ Updated user ${address.slice(0, 10)}... with name: ${name}`);
        }
      } else {
        // User doesn't exist, create new user
        const phone = generatePhoneNumber(parseInt(address.slice(2, 10), 16) || updatedCount);
        const city = indianCities[updatedCount % indianCities.length];

        await pool.query(
          `INSERT INTO users (address, name, phone, city, created_at, updated_at)
           VALUES (LOWER($1), $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (address) DO UPDATE 
           SET name = COALESCE(users.name, $2),
               phone = COALESCE(users.phone, $3),
               city = COALESCE(users.city, $4),
               updated_at = CURRENT_TIMESTAMP`,
          [address, name, phone, city]
        );
        updatedCount++;
        console.log(`✅ Created user ${address.slice(0, 10)}... with name: ${name}`);
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} users with names!`);

    // Verify the update
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM reviews r
      LEFT JOIN users u1 ON LOWER(r.reviewer_address) = LOWER(u1.address)
      LEFT JOIN users u2 ON LOWER(r.reviewee_address) = LOWER(u2.address)
      WHERE u1.name IS NULL OR u2.name IS NULL
    `;
    const verifyResult = await pool.query(verifyQuery);
    const remainingNull = parseInt(verifyResult.rows[0].count);

    if (remainingNull === 0) {
      console.log('✅ All reviews now have names!');
    } else {
      console.log(`⚠️  ${remainingNull} reviews still have null names.`);
    }

  } catch (error) {
    console.error('❌ Error updating reviews with names:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed.');
  }
}

// Run the script
updateReviewsWithNames()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

