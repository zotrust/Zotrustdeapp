-- Insert Sample Reviews for Zotrust Platform
-- This script inserts various reviews in English, Gujarati, and Hinglish
-- Each review has a different date spread over the past 3 months
-- All reviews are pre-approved and visible

-- Note: Replace the placeholder addresses with actual user addresses from your database
-- You can get user addresses by running: SELECT address FROM users LIMIT 20;

-- First, let's get some sample user addresses (you may need to adjust these)
-- For platform reviews, we'll use the same reviewee_address (platform address)
-- For user-to-user reviews, we'll use different addresses

-- ============================================
-- ENGLISH REVIEWS (Age 30-40, practical)
-- ============================================

-- Review 1: "I used Zotrust to swap cash ↔ USDT. The escrow worked fine and fees were low. Completed my first trade in ~20 minutes."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x1111111111111111111111111111111111111111', -- Replace with actual reviewer address
    '0x0000000000000000000000000000000000000000', -- Platform address (or use actual user address)
    NULL,
    5,
    'I used Zotrust to swap cash ↔ USDT. The escrow worked fine and fees were low. Completed my first trade in ~20 minutes.',
    true,
    true,
    NOW() - INTERVAL '85 days',
    1,
    NOW() - INTERVAL '85 days'
);

-- Review 2: "Good P2P flow and easy wallet connect. Had a small UI glitch but support helped within a day."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x2222222222222222222222222222222222222222', -- Replace with actual reviewer address
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'Good P2P flow and easy wallet connect. Had a small UI glitch but support helped within a day.',
    true,
    true,
    NOW() - INTERVAL '78 days',
    1,
    NOW() - INTERVAL '78 days'
);

-- Review 3: "Quick trades, clear terms, and reasonable fees. Recommended for regular P2P traders."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x3333333333333333333333333333333333333333',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Quick trades, clear terms, and reasonable fees. Recommended for regular P2P traders.',
    true,
    true,
    NOW() - INTERVAL '72 days',
    1,
    NOW() - INTERVAL '72 days'
);

-- ============================================
-- ENGLISH REVIEWS (Age 40-50+, reassuring/concise)
-- ============================================

-- Review 4: "Easy to use — I bought USDT without trouble. Escrow felt secure. Will use again."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x4444444444444444444444444444444444444444',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Easy to use — I bought USDT without trouble. Escrow felt secure. Will use again.',
    true,
    true,
    NOW() - INTERVAL '65 days',
    1,
    NOW() - INTERVAL '65 days'
);

-- Review 5: "Straightforward process for a non-tech person. Support was patient and helpful."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x5555555555555555555555555555555555555555',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Straightforward process for a non-tech person. Support was patient and helpful.',
    true,
    true,
    NOW() - INTERVAL '58 days',
    1,
    NOW() - INTERVAL '58 days'
);

-- Review 6: "I felt safe using Zotrust for cash to USDT. Transaction completed smoothly."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x6666666666666666666666666666666666666666',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'I felt safe using Zotrust for cash to USDT. Transaction completed smoothly.',
    true,
    true,
    NOW() - INTERVAL '51 days',
    1,
    NOW() - INTERVAL '51 days'
);

-- ============================================
-- GUJARATI REVIEWS (Age 30-40, friendly)
-- ============================================

-- Review 7: "Zotrust thi USDT kharidi karvi asaan hati. Escrow secure lage che ane fees ochhi hati. Recommend karu chu."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x7777777777777777777777777777777777777777',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Zotrust thi USDT kharidi karvi asaan hati. Escrow secure lage che ane fees ochhi hati. Recommend karu chu.',
    true,
    true,
    NOW() - INTERVAL '44 days',
    1,
    NOW() - INTERVAL '44 days'
);

-- Review 8: "Wallet connect saral che ane trade jaldi complete thayu. Support pan madadgar che."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x8888888888888888888888888888888888888888',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Wallet connect saral che ane trade jaldi complete thayu. Support pan madadgar che.',
    true,
    true,
    NOW() - INTERVAL '37 days',
    1,
    NOW() - INTERVAL '37 days'
);

-- ============================================
-- GUJARATI REVIEWS (Age 40-50+, reassuring)
-- ============================================

-- Review 9: "Platform samajva ma saral padi. Payment process safe hatu ane admin response pan sari hati."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x9999999999999999999999999999999999999999',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Platform samajva ma saral padi. Payment process safe hatu ane admin response pan sari hati.',
    true,
    true,
    NOW() - INTERVAL '30 days',
    1,
    NOW() - INTERVAL '30 days'
);

-- Review 10: "Pehli vaar P2P karto hoyu pan sab kuch theek rahi. Thanks, Zotrust."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Pehli vaar P2P karto hoyu pan sab kuch theek rahi. Thanks, Zotrust.',
    true,
    true,
    NOW() - INTERVAL '23 days',
    1,
    NOW() - INTERVAL '23 days'
);

-- ============================================
-- HINGLISH REVIEWS
-- ============================================

-- Review 11: "Platform theek hai — escrow pe trust kar sakte ho. Pehli trade 30 min me complete hui. Fees reasonable."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Platform theek hai — escrow pe trust kar sakte ho. Pehli trade 30 min me complete hui. Fees reasonable.',
    true,
    true,
    NOW() - INTERVAL '16 days',
    1,
    NOW() - INTERVAL '16 days'
);

-- Review 12: "Cash se USDT buy kiya, support ne help ki. Thoda UI improve karna chahiye par overall acha experience."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0xcccccccccccccccccccccccccccccccccccccccc',
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'Cash se USDT buy kiya, support ne help ki. Thoda UI improve karna chahiye par overall acha experience.',
    true,
    true,
    NOW() - INTERVAL '9 days',
    1,
    NOW() - INTERVAL '9 days'
);

-- Review 13: "Easy flow, fast payments, safe lagta hai. 4/5."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0xdddddddddddddddddddddddddddddddddddddddd',
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'Easy flow, fast payments, safe lagta hai. 4/5.',
    true,
    true,
    NOW() - INTERVAL '2 days',
    1,
    NOW() - INTERVAL '2 days'
);

-- ============================================
-- SHORT REVIEWS (English)
-- ============================================

-- Review 14: "Fast P2P trades, secure escrow, low fees. 4/5."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'Fast P2P trades, secure escrow, low fees. 4/5.',
    true,
    true,
    NOW() - INTERVAL '80 days',
    1,
    NOW() - INTERVAL '80 days'
);

-- Review 15: "Smooth wallet connect and quick payouts. Recommended."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0xffffffffffffffffffffffffffffffffffffffff',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Smooth wallet connect and quick payouts. Recommended.',
    true,
    true,
    NOW() - INTERVAL '73 days',
    1,
    NOW() - INTERVAL '73 days'
);

-- ============================================
-- SHORT REVIEWS (Gujarati)
-- ============================================

-- Review 16: "ઝપટદાર trades ane secure escrow — 4/5."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x1010101010101010101010101010101010101010',
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'ઝપટદાર trades ane secure escrow — 4/5.',
    true,
    true,
    NOW() - INTERVAL '66 days',
    1,
    NOW() - INTERVAL '66 days'
);

-- Review 17: "Aasaan ane bharosemand — recommend."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x2020202020202020202020202020202020202020',
    '0x0000000000000000000000000000000000000000',
    NULL,
    5,
    'Aasaan ane bharosemand — recommend.',
    true,
    true,
    NOW() - INTERVAL '59 days',
    1,
    NOW() - INTERVAL '59 days'
);

-- ============================================
-- SHORT REVIEWS (Hinglish)
-- ============================================

-- Review 18: "Quick trade, secure escrow — 4/5."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x3030303030303030303030303030303030303030',
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'Quick trade, secure escrow — 4/5.',
    true,
    true,
    NOW() - INTERVAL '52 days',
    1,
    NOW() - INTERVAL '52 days'
);

-- Review 19: "Good experience, thoda improvements chahiye in UI."
INSERT INTO reviews (
    reviewer_address,
    reviewee_address,
    order_id,
    rating,
    message,
    is_visible,
    is_approved,
    created_at,
    approved_by,
    approved_at
) VALUES (
    '0x4040404040404040404040404040404040404040',
    '0x0000000000000000000000000000000000000000',
    NULL,
    4,
    'Good experience, thoda improvements chahiye in UI.',
    true,
    true,
    NOW() - INTERVAL '45 days',
    1,
    NOW() - INTERVAL '45 days'
);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify all reviews were inserted:
-- SELECT id, reviewer_address, rating, message, created_at, is_approved, is_visible 
-- FROM reviews 
-- WHERE is_approved = true 
-- ORDER BY created_at DESC;

