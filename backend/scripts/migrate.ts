
import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../src/config/database';

const runMigrations = async () => {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Read and execute schema
    const schemaSQL = readFileSync(join(__dirname, '../src/models/schema.sql'), 'utf8');
    
    await pool.query(schemaSQL);
    
    console.log('✅ Database schema created successfully');
    
    // Seed some sample agents for testing
    const sampleAgents = [
      {
        branch_name: 'Mumbai Central Branch',
        city: 'Mumbai',
        address: 'Shop No. 123, Mumbai Central, Mumbai - 400008',
        mobile: '+91-9876543210',
        verified: true
      },
      {
        branch_name: 'Delhi CP Branch',
        city: 'Delhi',
        address: 'Connaught Place, New Delhi - 110001',
        mobile: '+91-9876543211',
        verified: true
      },
      {
        branch_name: 'Bangalore MG Road',
        city: 'Bangalore',
        address: 'MG Road, Bangalore - 560001',
        mobile: '+91-9876543212',
        verified: true
      },
      {
        branch_name: 'Chennai T Nagar',
        city: 'Chennai',
        address: 'T Nagar, Chennai - 600017',
        mobile: '+91-9876543213',
        verified: true
      },
      {
        branch_name: 'Kolkata Park Street',
        city: 'Kolkata',
        address: 'Park Street, Kolkata - 700016',
        mobile: '+91-9876543214',
        verified: true
      }
    ];
    
    console.log('🌱 Seeding sample agents...');
    
    for (const agent of sampleAgents) {
      await pool.query(
        `INSERT INTO agents (branch_name, city, address, mobile, verified, created_by_admin)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [agent.branch_name, agent.city, agent.address, agent.mobile, agent.verified, 1]
      );
    }
    
    console.log('✅ Sample agents seeded successfully');
    
    // Create logs directory if it doesn't exist
    const fs = require('fs');
    const logDir = join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
      console.log('✅ Logs directory created');
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations;
