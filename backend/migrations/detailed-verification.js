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

async function detailedVerification() {
  try {
    console.log('📖 Reading CSV file...');
    const csvPath = path.join(__dirname, 'hello.csv');
    const csvData = parseCSV(csvPath);
    console.log(`✅ CSV has ${csvData.length} rows\n`);
    
    // Get all agents from database with their locations
    const dbAgents = await pool.query(`
      SELECT a.mobile, a.city, a.address, l.name as location_name, l.id as location_id
      FROM agents a
      JOIN locations l ON a.location_id = l.id
    `);
    
    console.log(`📊 Database has ${dbAgents.rows.length} agents\n`);
    
    // Create maps for comparison
    const dbMobileMap = new Map();
    dbAgents.rows.forEach(a => {
      dbMobileMap.set(a.mobile, a);
    });
    
    // Get all locations
    const dbLocations = await pool.query('SELECT id, name, city, state FROM locations');
    const locationMap = new Map();
    dbLocations.rows.forEach(loc => {
      const key = `${loc.city}|${loc.state}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, loc);
      }
    });
    
    // Check each CSV row
    const missing = [];
    const found = [];
    const locationIssues = [];
    
    for (const row of csvData) {
      const dbAgent = dbMobileMap.get(row.mobile_no);
      
      if (!dbAgent) {
        // Check if location exists
        const key = `${row.city}|${row.state}`;
        const location = locationMap.get(key);
        
        if (location) {
          missing.push({ ...row, location_id: location.id, issue: 'Agent missing but location exists' });
        } else {
          locationIssues.push({ ...row, issue: 'Both agent and location missing' });
        }
      } else {
        found.push(row);
      }
    }
    
    console.log(`✅ Found in database: ${found.length}`);
    console.log(`❌ Missing agents (location exists): ${missing.length}`);
    console.log(`⚠️  Missing both agent and location: ${locationIssues.length}\n`);
    
    if (missing.length > 0) {
      console.log('📋 Missing Agents (will insert):');
      missing.slice(0, 10).forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.city} - ${row.mobile_no}`);
      });
      if (missing.length > 10) {
        console.log(`   ... and ${missing.length - 10} more\n`);
      }
      
      // Insert missing agents
      console.log('\n💾 Inserting missing agents...');
      let inserted = 0;
      
      for (const agent of missing) {
        const addressName = agent.address.split(',')[0].trim();
        
        try {
          await pool.query(
            `INSERT INTO agents (branch_name, city, address, mobile, location_id, verified, created_by_admin)
             VALUES ($1, $2, $3, $4, $5, true, 1)`,
            ['Kirti ambalal aagdiya', agent.city, addressName, agent.mobile_no, agent.location_id]
          );
          inserted++;
        } catch (error) {
          console.log(`   ✗ Failed: ${agent.city} - ${agent.mobile_no} - ${error.message}`);
        }
      }
      
      console.log(`✅ Inserted ${inserted} missing agents\n`);
    }
    
    if (locationIssues.length > 0) {
      console.log('⚠️  Locations that need to be created:');
      locationIssues.slice(0, 10).forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.city}, ${row.district}, ${row.state}`);
      });
      
      // Create missing locations and agents
      console.log('\n💾 Creating missing locations and agents...');
      let locCreated = 0;
      let agentCreated = 0;
      
      for (const row of locationIssues) {
        try {
          // Create location
          const locResult = await pool.query(
            `INSERT INTO locations (name, city, state, country, active)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            [row.city, row.city, row.state, row.country]
          );
          
          let locationId;
          if (locResult.rows.length > 0) {
            locationId = locResult.rows[0].id;
            locCreated++;
          } else {
            // Location already exists, get it
            const existing = await pool.query(
              'SELECT id FROM locations WHERE name = $1 AND city = $2 AND state = $3',
              [row.city, row.city, row.state]
            );
            locationId = existing.rows[0].id;
          }
          
          // Create agent
          const addressName = row.address.split(',')[0].trim();
          await pool.query(
            `INSERT INTO agents (branch_name, city, address, mobile, location_id, verified, created_by_admin)
             VALUES ($1, $2, $3, $4, $5, true, 1)`,
            ['Kirti ambalal aagdiya', row.city, addressName, row.mobile_no, locationId]
          );
          agentCreated++;
          
        } catch (error) {
          console.log(`   ✗ Failed: ${row.city} - ${row.mobile_no} - ${error.message}`);
        }
      }
      
      console.log(`✅ Created ${locCreated} locations and ${agentCreated} agents\n`);
    }
    
    // Final summary
    const finalAgents = await pool.query('SELECT COUNT(*) FROM agents');
    const finalLocations = await pool.query('SELECT COUNT(*) FROM locations');
    
    console.log('📊 Final Summary:');
    console.log(`   Total locations: ${finalLocations.rows[0].count}`);
    console.log(`   Total agents: ${finalAgents.rows[0].count}`);
    console.log(`   CSV rows: ${csvData.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

detailedVerification();

