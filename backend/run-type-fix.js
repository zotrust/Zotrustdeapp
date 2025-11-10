const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'zotrust',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function fixColumnType() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database successfully\n');
    
    console.log('🔍 Checking current column type...');
    
    const beforeCheck = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'selected_agent_ids'
    `);
    
    if (beforeCheck.rows.length > 0) {
      console.log(`   Current type: ${beforeCheck.rows[0].data_type} (${beforeCheck.rows[0].udt_name})\n`);
    }
    
    console.log('🔧 Running type conversion...\n');
    
    // Read and execute the fix SQL
    const sqlFile = path.join(__dirname, 'fix-selected-agents-type.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await client.query(sql);
    
    console.log('✅ Type conversion completed!\n');
    
    // Verify the change
    const afterCheck = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'selected_agent_ids'
    `);
    
    if (afterCheck.rows.length > 0) {
      console.log(`✨ New type: ${afterCheck.rows[0].data_type} (${afterCheck.rows[0].udt_name})\n`);
    }
    
    // Check sample data
    const sampleData = await client.query(`
      SELECT address, selected_agent_ids 
      FROM users 
      WHERE selected_agent_ids IS NOT NULL 
      LIMIT 3
    `);
    
    if (sampleData.rows.length > 0) {
      console.log('📊 Sample data:');
      sampleData.rows.forEach(row => {
        console.log(`   ${row.address}: ${JSON.stringify(row.selected_agent_ids)}`);
      });
    } else {
      console.log('📊 No users have selected agents yet');
    }
    
    client.release();
    await pool.end();
    
    console.log('\n✨ All done! Please restart your backend server.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

fixColumnType();

