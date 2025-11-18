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

async function verifyImport() {
  try {
    console.log('📖 Reading CSV file...');
    const csvPath = path.join(__dirname, 'hello.csv');
    const csvData = parseCSV(csvPath);
    console.log(`✅ CSV has ${csvData.length} rows\n`);
    
    // Get all agents from database
    const dbAgents = await pool.query('SELECT mobile, city, address FROM agents');
    const dbMobileSet = new Set(dbAgents.rows.map(a => a.mobile));
    
    console.log(`📊 Database has ${dbAgents.rows.length} agents\n`);
    
    // Check missing agents
    const missingAgents = [];
    const foundAgents = [];
    
    for (const row of csvData) {
      if (dbMobileSet.has(row.mobile_no)) {
        foundAgents.push(row);
      } else {
        missingAgents.push(row);
      }
    }
    
    console.log(`✅ Found in database: ${foundAgents.length}`);
    console.log(`❌ Missing from database: ${missingAgents.length}\n`);
    
    if (missingAgents.length > 0) {
      console.log('📋 Missing Agents:');
      missingAgents.slice(0, 20).forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.city} - ${row.mobile_no} (${row.address.substring(0, 50)}...)`);
      });
      if (missingAgents.length > 20) {
        console.log(`   ... and ${missingAgents.length - 20} more`);
      }
    }
    
    // Check locations
    console.log('\n📍 Checking Locations...');
    const dbLocations = await pool.query('SELECT name, city, state FROM locations');
    const locationMap = new Map();
    dbLocations.rows.forEach(loc => {
      const key = `${loc.name}|${loc.city}|${loc.state}`;
      locationMap.set(key, loc);
    });
    
    const csvLocations = new Map();
    csvData.forEach(row => {
      const key = `${row.city}|${row.city}|${row.state}`;
      if (!csvLocations.has(key)) {
        csvLocations.set(key, row);
      }
    });
    
    const missingLocations = [];
    csvLocations.forEach((row, key) => {
      if (!locationMap.has(key)) {
        missingLocations.push(row);
      }
    });
    
    console.log(`✅ Locations in database: ${dbLocations.rows.length}`);
    console.log(`📋 Unique locations in CSV: ${csvLocations.size}`);
    console.log(`❌ Missing locations: ${missingLocations.length}`);
    
    if (missingLocations.length > 0) {
      console.log('\n📋 Missing Locations:');
      missingLocations.forEach((row, idx) => {
        console.log(`   ${idx + 1}. ${row.city}, ${row.district}, ${row.state}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

verifyImport();

