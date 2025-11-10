const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'zotrust',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function fixSchema() {
  try {
    console.log('🔄 Adding location columns to agents table...');
    
    // Add columns
    await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS state VARCHAR(100)');
    await pool.query('ALTER TABLE agents ADD COLUMN IF NOT EXISTS country VARCHAR(100)');
    
    console.log('✅ Columns added successfully');
    
    // Add indexes
    console.log('🔄 Adding indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agents_state ON agents(state)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_agents_country ON agents(country)');
    
    console.log('✅ Indexes created successfully');
    
    // Insert sample data
    console.log('🔄 Inserting sample data...');
    await pool.query(`
      INSERT INTO agents (branch_name, city, state, country, address, mobile, verified, created_by_admin) VALUES
      ('Mumbai Central Branch', 'Mumbai', 'Maharashtra', 'India', '123 MG Road, Mumbai', '+91-9876543210', true, 1),
      ('Delhi North Branch', 'Delhi', 'Delhi', 'India', '456 CP, New Delhi', '+91-9876543211', true, 1),
      ('Bangalore Tech Branch', 'Bangalore', 'Karnataka', 'India', '789 IT Park, Bangalore', '+91-9876543212', true, 1),
      ('Chennai South Branch', 'Chennai', 'Tamil Nadu', 'India', '321 Marina Beach, Chennai', '+91-9876543213', false, 1),
      ('Kolkata East Branch', 'Kolkata', 'West Bengal', 'India', '654 Park Street, Kolkata', '+91-9876543214', true, 1)
      ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Sample data inserted successfully');
    console.log('🎉 Database schema update completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixSchema();
