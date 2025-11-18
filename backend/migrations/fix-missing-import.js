const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  host: '185.112.144.66',
  port: 5432,
  database: 'zotrust',
  user: 'postgres',
  password: 'postgres'
});

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    if (values.length >= 6) {
      const row = {
        address: values[0].replace(/^"|"$/g, ''),
        city: values[1],
        district: values[2],
        state: values[3],
        country: values[4] || 'India',
        mobile_no: values[5]
      };
      
      // Skip rows with multiple mobile numbers
      if (row.mobile_no && !row.mobile_no.includes(';')) {
        data.push(row);
      }
    }
  }
  
  return data;
}

async function fixMissingData() {
  try {
    console.log('📖 Reading CSV file...');
    const csvPath = path.join(__dirname, 'hello.csv');
    const csvData = parseCSV(csvPath);
    console.log(`✅ Parsed ${csvData.length} rows\n`);
    
    // Get existing agents
    const existingAgents = await pool.query('SELECT mobile FROM agents');
    const existingMobiles = new Set(existingAgents.rows.map(a => a.mobile));
    console.log(`📊 Existing agents in DB: ${existingAgents.rows.length}\n`);
    
    // Get all locations
    const locations = await pool.query('SELECT id, name, city, state FROM locations');
    const locationMap = new Map();
    locations.rows.forEach(loc => {
      const key = `${loc.city}|${loc.state}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, loc);
      }
    });
    
    // Find missing agents
    const missingAgents = [];
    for (const row of csvData) {
      if (!existingMobiles.has(row.mobile_no)) {
        const key = `${row.city}|${row.state}`;
        const location = locationMap.get(key);
        
        if (location) {
          missingAgents.push({
            ...row,
            location_id: location.id
          });
        } else {
          console.log(`⚠️  No location found for: ${row.city}, ${row.state}`);
        }
      }
    }
    
    console.log(`❌ Found ${missingAgents.length} missing agents\n`);
    
    if (missingAgents.length > 0) {
      console.log('💾 Inserting missing agents...\n');
      let inserted = 0;
      
      for (const agent of missingAgents) {
        const addressName = agent.address.split(',')[0].trim();
        
        try {
          await pool.query(
            `INSERT INTO agents (branch_name, city, address, mobile, location_id, verified, created_by_admin)
             VALUES ($1, $2, $3, $4, $5, true, 1)`,
            ['Kirti ambalal aagdiya', agent.city, addressName, agent.mobile_no, agent.location_id]
          );
          inserted++;
          console.log(`   ✓ Inserted: ${agent.city} - ${agent.mobile_no}`);
        } catch (error) {
          console.log(`   ✗ Failed: ${agent.city} - ${agent.mobile_no} - ${error.message}`);
        }
      }
      
      console.log(`\n✅ Inserted ${inserted} missing agents`);
    } else {
      console.log('✅ All agents are already in database!');
    }
    
    // Final count
    const finalCount = await pool.query('SELECT COUNT(*) FROM agents');
    console.log(`\n📊 Final agent count: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixMissingData();

