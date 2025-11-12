# Insert Sample Reviews Script

This script inserts sample reviews in English, Gujarati, and Hinglish into the Zotrust database.

## Reviews Included

### English Reviews (Age 30-40, practical)
- "I used Zotrust to swap cash ↔ USDT. The escrow worked fine and fees were low. Completed my first trade in ~20 minutes."
- "Good P2P flow and easy wallet connect. Had a small UI glitch but support helped within a day."
- "Quick trades, clear terms, and reasonable fees. Recommended for regular P2P traders."

### English Reviews (Age 40-50+, reassuring/concise)
- "Easy to use — I bought USDT without trouble. Escrow felt secure. Will use again."
- "Straightforward process for a non-tech person. Support was patient and helpful."
- "I felt safe using Zotrust for cash to USDT. Transaction completed smoothly."

### Gujarati Reviews (Age 30-40, friendly)
- "Zotrust thi USDT kharidi karvi asaan hati. Escrow secure lage che ane fees ochhi hati. Recommend karu chu."
- "Wallet connect saral che ane trade jaldi complete thayu. Support pan madadgar che."

### Gujarati Reviews (Age 40-50+, reassuring)
- "Platform samajva ma saral padi. Payment process safe hatu ane admin response pan sari hati."
- "Pehli vaar P2P karto hoyu pan sab kuch theek rahi. Thanks, Zotrust."

### Hinglish Reviews
- "Platform theek hai — escrow pe trust kar sakte ho. Pehli trade 30 min me complete hui. Fees reasonable."
- "Cash se USDT buy kiya, support ne help ki. Thoda UI improve karna chahiye par overall acha experience."
- "Easy flow, fast payments, safe lagta hai. 4/5."

### Short Reviews
- English: "Fast P2P trades, secure escrow, low fees. 4/5."
- English: "Smooth wallet connect and quick payouts. Recommended."
- Gujarati: "ઝપટદાર trades ane secure escrow — 4/5."
- Gujarati: "Aasaan ane bharosemand — recommend."
- Hinglish: "Quick trade, secure escrow — 4/5."
- Hinglish: "Good experience, thoda improvements chahiye in UI."

## How to Use

### Option 1: TypeScript Script (Recommended)

```bash
# From backend directory
npx ts-node scripts/insert-sample-reviews.ts
```

### Option 2: SQL Script

```bash
# From backend directory
psql -U your_username -d your_database -f scripts/insert-sample-reviews.sql
```

**Note:** Before running the SQL script, you need to:
1. Replace placeholder addresses (`0x1111...`, `0x2222...`, etc.) with actual user addresses from your database
2. Get user addresses by running: `SELECT address FROM users LIMIT 20;`

## What the Script Does

1. **Fetches User Addresses**: Gets up to 20 user addresses from the database
2. **Assigns Reviewers**: Cycles through users to assign as reviewers
3. **Assigns Reviewees**: 
   - For platform reviews: Uses the first user as platform address
   - For user-to-user reviews: Uses different users
4. **Sets Dates**: Each review has a different date spread over the past 3 months
5. **Pre-approves**: All reviews are marked as `is_approved = true` and `is_visible = true`
6. **Prevents Duplicates**: Checks for existing reviews before inserting

## Review Distribution

- **Total Reviews**: 19 reviews
- **Date Range**: Past 85 days (approximately 3 months)
- **Ratings**: Mix of 4-star and 5-star reviews
- **Languages**: English, Gujarati, Hinglish
- **All Approved**: All reviews are pre-approved by admin (ID: 1)

## Verification

After running the script, verify the reviews:

```sql
SELECT 
  id, 
  reviewer_address, 
  rating, 
  LEFT(message, 50) as message_preview,
  created_at, 
  is_approved, 
  is_visible 
FROM reviews 
WHERE is_approved = true 
ORDER BY created_at DESC;
```

## Customization

To customize the script:

1. **Change Platform Address**: Edit the `platformAddress` variable in the TypeScript script
2. **Change Admin ID**: Edit the `adminId` variable (default: 1)
3. **Add More Reviews**: Add more review objects to the `reviews` array
4. **Change Date Range**: Modify the date calculations in the `created_at` field

## Requirements

- Node.js and TypeScript installed
- Database connection configured in `backend/src/config/database.ts`
- At least 2 users in the database
- Admin user with ID 1 exists (for `approved_by` field)

## Troubleshooting

### Error: "No users found in database"
- Make sure you have users in the database
- Run: `SELECT COUNT(*) FROM users;` to check

### Error: "Foreign key constraint violation"
- Make sure the user addresses exist in the `users` table
- Addresses are case-insensitive (converted to lowercase)

### Error: "Duplicate review"
- The script skips duplicates automatically
- To force insert, remove the duplicate check in the script

## Notes

- All addresses are normalized to lowercase
- Reviews are inserted with different timestamps
- The script is idempotent (can be run multiple times safely)
- Duplicate reviews are automatically skipped

