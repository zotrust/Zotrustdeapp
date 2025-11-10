import pool from '../config/database';
import fs from 'fs';
import path from 'path';

const runUnderDisputeMigration = async () => {
  try {
    console.log('🔄 Running UNDER_DISPUTE state migration...');
    
    const migrationPath = path.join(__dirname, '../../migrations/add-under-dispute-state.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('SELECT'));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        await pool.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        if (error.code === '42704') {
          console.log(`ℹ️  Constraint already dropped, continuing...`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    // Verify the constraint
    console.log('🔍 Verifying constraint...');
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname = 'orders_state_check'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Constraint updated successfully:');
      console.log(result.rows[0].pg_get_constraintdef);
    } else {
      console.warn('⚠️  Constraint not found after migration');
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  runUnderDisputeMigration();
}

export default runUnderDisputeMigration;

