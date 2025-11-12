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

import pool from '../src/config/database';
import { randomBytes } from 'crypto';

interface Review {
  reviewer_address: string;
  reviewer_name: string;
  reviewee_address: string;
  reviewee_name: string;
  order_id: number | null;
  rating: number;
  message: string;
  created_at: Date;
}

// Indian Names (Mix of Hindi, Gujarati, English Indian names)
const indianNames = [
  'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Desai', 'Vikram Singh',
  'Kavita Mehta', 'Rahul Shah', 'Anjali Joshi', 'Suresh Gupta', 'Divya Reddy',
  'Manoj Agarwal', 'Pooja Verma', 'Nikhil Jain', 'Swati Kapoor', 'Arjun Malhotra',
  'Neha Trivedi', 'Karan Bhatt', 'Riya Chawla', 'Harsh Dave', 'Shreya Modi',
  'Rohan Mehta', 'Isha Shah', 'Yash Patel', 'Aarohi Desai', 'Vedant Joshi',
  'Ananya Singh', 'Dhruv Kumar', 'Ishita Sharma', 'Arnav Agarwal', 'Saanvi Reddy',
  'Advik Gupta', 'Anvi Patel', 'Vihaan Shah', 'Aadhya Mehta', 'Aarav Joshi',
  'Krishna Desai', 'Radha Patel', 'Shivam Kumar', 'Gauri Sharma', 'Om Singh',
  'Lakshmi Reddy', 'Vishnu Agarwal', 'Saraswati Mehta', 'Ganesh Joshi', 'Parvati Shah'
];

// Indian Cities
const indianCities = [
  'Mumbai', 'Delhi', 'Bangalore', 'Ahmedabad', 'Pune', 'Surat', 'Jaipur',
  'Chennai', 'Hyderabad', 'Kolkata', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
  'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad'
];

// Generate random Ethereum address
function generateRandomAddress(): string {
  const randomHex = randomBytes(20).toString('hex');
  return '0x' + randomHex;
}

// Sample reviews data - 35 reviews
const reviews: Review[] = [
  // English Reviews (Age 30-40, practical)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I used Zotrust to swap cash ↔ USDT. The escrow worked fine and fees were low. Completed my first trade in ~20 minutes.',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Good P2P flow and easy wallet connect. Had a small UI glitch but support helped within a day.',
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Quick trades, clear terms, and reasonable fees. Recommended for regular P2P traders.',
    created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Fast and secure platform. Completed multiple trades without any issues. Great experience!',
    created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Easy to use interface. Escrow system is reliable. Would recommend to friends.',
    created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000)
  },
  
  // English Reviews (Age 40-50+, reassuring/concise)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Easy to use — I bought USDT without trouble. Escrow felt secure. Will use again.',
    created_at: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Straightforward process for a non-tech person. Support was patient and helpful.',
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I felt safe using Zotrust for cash to USDT. Transaction completed smoothly.',
    created_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Simple and secure. Good for first-time crypto users. Support team is responsive.',
    created_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Trustworthy platform. Completed my transaction without any hassles. Highly recommended.',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  },
  
  // Gujarati Reviews (Age 30-40, friendly)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Zotrust thi USDT kharidi karvi asaan hati. Escrow secure lage che ane fees ochhi hati. Recommend karu chu.',
    created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Wallet connect saral che ane trade jaldi complete thayu. Support pan madadgar che.',
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Platform aavjo che, fees reasonable che. Ek vaar try karo, definitely recommend karu chu.',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Bilkul safe ane secure platform. Multiple trades kari chhe, badhiya experience.',
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
  },
  
  // Gujarati Reviews (Age 40-50+, reassuring)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Platform samajva ma saral padi. Payment process safe hatu ane admin response pan sari hati.',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Pehli vaar P2P karto hoyu pan sab kuch theek rahi. Thanks, Zotrust.',
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Bharosemand platform che. Thoda UI improve thai sake pan overall acha che.',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  },
  
  // Hinglish Reviews
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Platform theek hai — escrow pe trust kar sakte ho. Pehli trade 30 min me complete hui. Fees reasonable.',
    created_at: new Date(Date.now() - 88 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Cash se USDT buy kiya, support ne help ki. Thoda UI improve karna chahiye par overall acha experience.',
    created_at: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Easy flow, fast payments, safe lagta hai. 4/5.',
    created_at: new Date(Date.now() - 78 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Bahut acha platform hai. Quick transactions aur secure escrow. Recommend karta hoon.',
    created_at: new Date(Date.now() - 73 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Good experience, thoda improvements chahiye in UI but overall solid platform.',
    created_at: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000)
  },
  
  // Short Reviews (English)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Fast P2P trades, secure escrow, low fees. 4/5.',
    created_at: new Date(Date.now() - 63 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Smooth wallet connect and quick payouts. Recommended.',
    created_at: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Excellent service. Fast and reliable. Will use again.',
    created_at: new Date(Date.now() - 53 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Good platform for P2P trading. Secure and user-friendly.',
    created_at: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000)
  },
  
  // Short Reviews (Gujarati)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'ઝપટદાર trades ane secure escrow — 4/5.',
    created_at: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Aasaan ane bharosemand — recommend.',
    created_at: new Date(Date.now() - 37 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Badhiya platform che, jaldi trade complete thai jay che.',
    created_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000)
  },
  
  // Short Reviews (Hinglish)
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Quick trade, secure escrow — 4/5.',
    created_at: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Good experience, thoda improvements chahiye in UI.',
    created_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Best P2P platform hai. Fast, secure, aur reliable.',
    created_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Acha platform hai. Fees reasonable hai aur support bhi good hai.',
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Perfect platform for crypto trading. Highly satisfied.',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 4,
    message: 'Smooth experience. Easy to use and secure.',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  },
  
  // Reviews with Transaction Amounts and Counts
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have done 2 lakh worth of transactions on Zotrust. Very reliable platform with secure escrow. Highly recommended!',
    created_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Completed transactions worth 1.5 lakh. Platform is trustworthy and fees are reasonable. Will continue using.',
    created_at: new Date(Date.now() - 92 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Done 50+ transactions on this platform. Total value around 3 lakh. Never faced any issue. Best P2P platform!',
    created_at: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have completed 75+ trades worth 4 lakh on Zotrust. Escrow system is excellent and fees are low. Perfect for regular traders.',
    created_at: new Date(Date.now() - 82 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Done transactions worth 2.5 lakh. Platform is secure and user-friendly. Support team is very helpful.',
    created_at: new Date(Date.now() - 79 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have done 3 lakh worth of transactions. Zotrust is my go-to platform for P2P trading. Fast, secure, and trustworthy.',
    created_at: new Date(Date.now() - 69 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Completed 60+ trades worth 3.5 lakh. Excellent platform with great escrow system. Recommended for serious traders.',
    created_at: new Date(Date.now() - 66 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have completed 40+ trades, total value 2.2 lakh. All went smoothly. Best P2P platform I have used so far.',
    created_at: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Traded 2.8 lakh worth on Zotrust. Platform is secure and transactions are fast. Support is responsive. 5/5!',
    created_at: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Done 100+ transactions worth 5 lakh. Zotrust is reliable and fees are low. Perfect for high-volume traders.',
    created_at: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have done 2.3 lakh worth of transactions. Platform is excellent, escrow works perfectly. Highly recommended!',
    created_at: new Date(Date.now() - 46 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Traded 4 lakh worth, completed 80+ transactions. Zotrust is the best P2P platform. Fast, secure, and reliable.',
    created_at: new Date(Date.now() - 43 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have done 3.2 lakh worth of transactions on Zotrust. Platform is trustworthy and escrow system is excellent.',
    created_at: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Traded 2.6 lakh, completed 55+ transactions. All went perfectly. Best experience with any P2P platform.',
    created_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Done 90+ trades worth 4.5 lakh. Zotrust is reliable, fast, and secure. Perfect for regular crypto traders.',
    created_at: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'I have done 2.4 lakh worth of transactions. Platform works great, fees are low. Will continue using Zotrust.',
    created_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Traded 3.8 lakh, done 70+ transactions. All successful. Zotrust is the most reliable P2P platform I know.',
    created_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000)
  },
  {
    reviewer_address: '',
    reviewer_name: '',
    reviewee_address: '',
    reviewee_name: '',
    order_id: null,
    rating: 5,
    message: 'Completed 35+ trades worth 2.1 lakh. Excellent experience. Platform is secure and support is helpful.',
    created_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)
  }
];

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
