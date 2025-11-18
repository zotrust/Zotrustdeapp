const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: '185.112.144.66',
  port: 5432,
  database: 'zotrust',
  user: 'postgres',
  password: 'postgres'
});

// Read and parse CSV
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV line (handling quoted fields)
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
    values.push(current.trim()); // Last value
    
    if (values.length >= 6) {
      const row = {
        address: values[0].replace(/^"|"$/g, ''),
        city: values[1],
        district: values[2],
        state: values[3],
        country: values[4] || 'India',
        mobile_no: values[5]
      };
      
      // Skip rows with multiple mobile numbers (containing semicolon)
      if (row.mobile_no && !row.mobile_no.includes(';')) {
        data.push(row);
      }
    }
  }
  
  return data;
}

async function importData() {
  try {
    console.log('📖 Reading CSV file...');
    const csvPath = path.join(__dirname, 'hello.csv');
    const csvData = parseCSV(csvPath);
    console.log(`✅ Parsed ${csvData.length} rows (excluding multiple mobile numbers)`);
    
    // Step 1: Extract unique locations
    console.log('\n📍 Step 1: Extracting unique locations...');
    const locationMap = new Map();
    
    csvData.forEach(row => {
      const key = `${row.city}|${row.district}|${row.state}|${row.country}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          name: row.city,
          city: row.city,
          state: row.state,
          country: row.country || 'India',
          district: row.district
        });
      }
    });
    
    console.log(`✅ Found ${locationMap.size} unique locations`);
    
    // Step 2: Insert locations
    console.log('\n💾 Step 2: Inserting locations into database...');
    const locationIdMap = new Map();
    
    for (const [key, location] of locationMap) {
      // Check if location already exists
      const checkResult = await pool.query(
        `SELECT id FROM locations WHERE name = $1 AND city = $2 AND state = $3 AND country = $4`,
        [location.name, location.city, location.state, location.country]
      );
      
      if (checkResult.rows.length > 0) {
        locationIdMap.set(key, checkResult.rows[0].id);
        console.log(`   ✓ Location exists: ${location.name} (ID: ${checkResult.rows[0].id})`);
      } else {
        const insertResult = await pool.query(
          `INSERT INTO locations (name, city, state, country, active) 
           VALUES ($1, $2, $3, $4, true) 
           RETURNING id`,
          [location.name, location.city, location.state, location.country]
        );
        locationIdMap.set(key, insertResult.rows[0].id);
        console.log(`   ✓ Created location: ${location.name} (ID: ${insertResult.rows[0].id})`);
      }
    }
    
    // Step 3: Insert agents
    console.log('\n👥 Step 3: Inserting agents into database...');
    let inserted = 0;
    let skipped = 0;
    
    for (const row of csvData) {
      const key = `${row.city}|${row.district}|${row.state}|${row.country}`;
      const locationId = locationIdMap.get(key);
      
      if (!locationId) {
        console.log(`   ⚠️  Skipping: No location found for ${row.city}`);
        skipped++;
        continue;
      }
      
      // Check if agent already exists (by mobile)
      const checkAgent = await pool.query(
        `SELECT id FROM agents WHERE mobile = $1`,
        [row.mobile_no]
      );
      
      if (checkAgent.rows.length > 0) {
        console.log(`   ⊘ Agent exists: ${row.mobile_no}`);
        skipped++;
        continue;
      }
      
      // Extract address name from full address (first part before comma)
      const addressName = row.address.split(',')[0].trim();
      
      // Insert agent
      await pool.query(
        `INSERT INTO agents (branch_name, city, address, mobile, location_id, verified, created_by_admin)
         VALUES ($1, $2, $3, $4, $5, true, 1)`,
        ['Kirti ambalal aagdiya', row.city, addressName, row.mobile_no, locationId]
      );
      
      inserted++;
      if (inserted % 10 === 0) {
        console.log(`   ✓ Inserted ${inserted} agents...`);
      }
    }
    
    console.log(`\n✅ Import Complete!`);
    console.log(`   📍 Locations: ${locationMap.size}`);
    console.log(`   👥 Agents inserted: ${inserted}`);
    console.log(`   ⊘ Agents skipped: ${skipped}`);
    
    // Final summary
    const locationCount = await pool.query('SELECT COUNT(*) FROM locations');
    const agentCount = await pool.query('SELECT COUNT(*) FROM agents');
    
    console.log(`\n📊 Database Summary:`);
    console.log(`   Total locations: ${locationCount.rows[0].count}`);
    console.log(`   Total agents: ${agentCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run import
importData()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });

