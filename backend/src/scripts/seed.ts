import pool from '../config/database';

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Create mock agents
    console.log('👥 Creating mock agents...');
    await pool.query(`
      INSERT INTO agents (id, branch_name, city, address, mobile, verified, created_by_admin, created_at, updated_at)
      VALUES 
        (1, 'Mumbai Central', 'Mumbai', '123 Main Street, Mumbai', '+91 9876543210', true, 1, NOW(), NOW()),
        (2, 'Delhi North', 'Delhi', '456 Park Avenue, Delhi', '+91 9876543211', true, 1, NOW(), NOW()),
        (3, 'Bangalore Tech', 'Bangalore', '789 IT Park, Bangalore', '+91 9876543212', true, 1, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Create mock users
    console.log('👤 Creating mock users...');
    await pool.query(`
      INSERT INTO users (id, address, name, phone, city, selected_agent_id, verified, verified_at, created_at, updated_at)
      VALUES 
        (1, '0x1234567890123456789012345678901234567890', 'Development User', '+91 9876543210', 'Mumbai', 1, true, NOW(), NOW(), NOW()),
        (2, '0x2345678901234567890123456789012345678901', 'Test User 1', '+91 9876543211', 'Delhi', 2, true, NOW(), NOW(), NOW()),
        (3, '0x3456789012345678901234567890123456789012', 'Test User 2', '+91 9876543212', 'Bangalore', 3, true, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Create mock ads
    console.log('📢 Creating mock ads...');
    await pool.query(`
      INSERT INTO ads (id, owner_address, owner_selected_agent_id, type, token, price_inr, min_amount, max_amount, lock_duration_seconds, city, active, created_at, updated_at)
      VALUES 
        (1, '0x1234567890123456789012345678901234567890', 1, 'BUY', 'USDT', 85.50, 1000, 50000, 3600, 'Mumbai', true, NOW(), NOW()),
        (2, '0x2345678901234567890123456789012345678901', 2, 'SELL', 'USDT', 86.00, 500, 25000, 7200, 'Delhi', true, NOW(), NOW()),
        (3, '0x3456789012345678901234567890123456789012', 3, 'BUY', 'USDC', 85.75, 2000, 100000, 1800, 'Bangalore', true, NOW(), NOW()),
        (4, '0x1234567890123456789012345678901234567890', 1, 'SELL', 'USDC', 85.25, 1500, 75000, 5400, 'Mumbai', true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log('✅ Database seeding completed successfully!');
    
    // Verify data
    const agentCount = await pool.query('SELECT COUNT(*) FROM agents');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const adCount = await pool.query('SELECT COUNT(*) FROM ads');
    
    console.log(`📊 Seeded data:`);
    console.log(`  - Agents: ${agentCount.rows[0].count}`);
    console.log(`  - Users: ${userCount.rows[0].count}`);
    console.log(`  - Ads: ${adCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
