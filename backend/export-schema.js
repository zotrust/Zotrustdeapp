const { Pool } = require('pg');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'zotrust',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function exportSchema() {
  try {
    console.log('📦 Exporting complete database schema...');
    console.log('==========================================\n');

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to database successfully\n');
    client.release();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputFile = `zotrust-complete-schema-export-${timestamp}.sql`;
    const schemaOnlyFile = `zotrust-schema-only-${timestamp}.sql`;

    const dbName = process.env.DB_NAME || 'zotrust';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';

    // Export complete schema + data
    console.log('📤 Exporting complete database (schema + data)...');
    try {
      process.env.PGPASSWORD = dbPassword;
      await execPromise(
        `pg_dump -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} --clean --if-exists --no-owner --no-privileges -f ${outputFile}`
      );
      const stats = fs.statSync(outputFile);
      const lines = fs.readFileSync(outputFile, 'utf8').split('\n').length;
      console.log(`✅ Complete database exported to: ${outputFile}`);
      console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`📄 Total lines: ${lines}\n`);
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      process.exit(1);
    }

    // Export schema only
    console.log('📤 Exporting schema only (structure, no data)...');
    try {
      await execPromise(
        `pg_dump -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} --schema-only --clean --if-exists --no-owner --no-privileges -f ${schemaOnlyFile}`
      );
      const stats = fs.statSync(schemaOnlyFile);
      const lines = fs.readFileSync(schemaOnlyFile, 'utf8').split('\n').length;
      console.log(`✅ Schema-only exported to: ${schemaOnlyFile}`);
      console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`📄 Total lines: ${lines}\n`);
    } catch (error) {
      console.error('⚠️  Schema-only export failed:', error.message);
    }

    console.log('==========================================');
    console.log('✅ Export Complete!');
    console.log('==========================================\n');
    console.log('📁 Generated files:');
    console.log(`   1. Complete (schema + data): ${outputFile}`);
    console.log(`   2. Schema only: ${schemaOnlyFile}\n`);
    console.log('💡 To restore database:');
    console.log(`   psql -U ${dbUser} -h ${dbHost} -p ${dbPort} -d ${dbName} -f ${outputFile}\n`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

exportSchema();

