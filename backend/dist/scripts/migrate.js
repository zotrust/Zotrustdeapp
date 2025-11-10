"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const runMigrations = async () => {
    try {
        console.log('🔄 Starting database migration...');
        // Read the schema file
        const schemaPath = path_1.default.join(__dirname, '../models/schema.sql');
        const schema = fs_1.default.readFileSync(schemaPath, 'utf8');
        // Split the schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
                await database_1.default.query(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            }
            catch (error) {
                // If table already exists, that's okay
                if (error.code === '42P07') {
                    console.log(`ℹ️  Table already exists, skipping statement ${i + 1}`);
                }
                else {
                    console.error(`❌ Error executing statement ${i + 1}:`, error.message);
                    throw error;
                }
            }
        }
        console.log('🎉 Database migration completed successfully!');
        // Verify tables exist
        console.log('🔍 Verifying tables...');
        const result = await database_1.default.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
        console.log('📊 Available tables:');
        result.rows.forEach((row) => {
            console.log(`  - ${row.table_name}`);
        });
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
    finally {
        await database_1.default.end();
    }
};
// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations();
}
exports.default = runMigrations;
