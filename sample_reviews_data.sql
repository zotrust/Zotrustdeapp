-- Sample Reviews Data for Testing
-- Insert sample reviews into the reviews table

-- Note: Make sure these addresses exist in your users table
-- You may need to adjust the addresses to match actual users in your database

INSERT INTO reviews (order_id, reviewer_address, reviewee_address, rating, comment, created_at) VALUES
-- Positive reviews
(NULL, '0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 5, 'Excellent seller! Fast response and smooth transaction. Highly recommended!', NOW() - INTERVAL '30 days'),
(NULL, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', '0x1234567890123456789012345678901234567890', 5, 'Great buyer! Payment was instant and communication was clear.', NOW() - INTERVAL '29 days'),
(NULL, '0x9876543210987654321098765432109876543210', '0xfedcbafedcbafedcbafedcbafedcbafedcbafed', 4, 'Good experience overall. Transaction completed without issues.', NOW() - INTERVAL '25 days'),
(NULL, '0xfedcbafedcbafedcbafedcbafedcbafedcbafed', '0x9876543210987654321098765432109876543210', 5, 'Perfect transaction! Very professional and trustworthy.', NOW() - INTERVAL '24 days'),
(NULL, '0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222', 5, 'Best P2P experience ever! Quick and reliable.', NOW() - INTERVAL '20 days'),

-- Good reviews
(NULL, '0x2222222222222222222222222222222222222222', '0x1111111111111111111111111111111111111111', 4, 'Smooth transaction, friendly person to deal with.', NOW() - INTERVAL '19 days'),
(NULL, '0x3333333333333333333333333333333333333333', '0x4444444444444444444444444444444444444444', 4, 'Good trader. Everything went as expected.', NOW() - INTERVAL '15 days'),
(NULL, '0x4444444444444444444444444444444444444444', '0x3333333333333333333333333333333333333333', 5, 'Very satisfied with the trade. Will trade again!', NOW() - INTERVAL '14 days'),
(NULL, '0x5555555555555555555555555555555555555555', '0x6666666666666666666666666666666666666666', 4, 'Reliable and professional. No complaints.', NOW() - INTERVAL '10 days'),
(NULL, '0x6666666666666666666666666666666666666666', '0x5555555555555555555555555555555555555555', 5, 'Fantastic experience! Highly recommend this trader.', NOW() - INTERVAL '9 days'),

-- Mixed reviews
(NULL, '0x7777777777777777777777777777777777777777', '0x8888888888888888888888888888888888888888', 3, 'Average experience. Transaction took a bit longer than expected.', NOW() - INTERVAL '8 days'),
(NULL, '0x8888888888888888888888888888888888888888', '0x7777777777777777777777777777777777777777', 4, 'Good trade overall. Minor communication delays but resolved well.', NOW() - INTERVAL '7 days'),
(NULL, '0x9999999999999999999999999999999999999999', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 5, 'Outstanding! Quick payment and great communication.', NOW() - INTERVAL '5 days'),
(NULL, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '0x9999999999999999999999999999999999999999', 4, 'Pleasant trading experience. Would recommend.', NOW() - INTERVAL '4 days'),
(NULL, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', '0xcccccccccccccccccccccccccccccccccccccccc', 5, 'Superb trader! Very trustworthy and efficient.', NOW() - INTERVAL '3 days'),

-- Recent reviews
(NULL, '0xcccccccccccccccccccccccccccccccccccccccc', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 5, 'Excellent service! Fast and professional.', NOW() - INTERVAL '2 days'),
(NULL, '0xdddddddddddddddddddddddddddddddddddddddd', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 4, 'Good experience. Trade completed smoothly.', NOW() - INTERVAL '1 day'),
(NULL, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', '0xdddddddddddddddddddddddddddddddddddddddd', 5, 'Perfect! Will definitely trade again.', NOW() - INTERVAL '12 hours'),
(NULL, '0xffffffffffffffffffffffffffffffffffffffff', '0x0000000000000000000000000000000000000001', 5, 'Amazing trader! Best rates and quick service.', NOW() - INTERVAL '6 hours'),
(NULL, '0x0000000000000000000000000000000000000001', '0xffffffffffffffffffffffffffffffffffffffff', 5, 'Highly recommended! Very professional and reliable.', NOW() - INTERVAL '3 hours'),

-- Additional diverse reviews
(NULL, '0x1234567890123456789012345678901234567890', '0x9999999999999999999999999999999999999999', 4, 'Good trade. Seller was responsive and helpful.', NOW() - INTERVAL '2 hours'),
(NULL, '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', '0x7777777777777777777777777777777777777777', 5, 'Excellent! Transaction was fast and secure.', NOW() - INTERVAL '1 hour'),
(NULL, '0x5555555555555555555555555555555555555555', '0x1111111111111111111111111111111111111111', 4, 'Very good experience. Would trade again.', NOW() - INTERVAL '30 minutes'),
(NULL, '0x3333333333333333333333333333333333333333', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 5, 'Perfect trader! Quick and trustworthy.', NOW() - INTERVAL '15 minutes'),
(NULL, '0x2222222222222222222222222222222222222222', '0xcccccccccccccccccccccccccccccccccccccccc', 5, 'Outstanding service! Highly professional.', NOW() - INTERVAL '5 minutes');

-- Display summary
SELECT 
    COUNT(*) as total_reviews,
    ROUND(AVG(rating), 2) as average_rating,
    COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
    COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
    COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
    COUNT(CASE WHEN rating <= 2 THEN 1 END) as two_or_less
FROM reviews;

