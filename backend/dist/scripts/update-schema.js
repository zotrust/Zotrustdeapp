"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
async function updateSchema() {
    try {
        console.log('🔄 Starting database schema update...');
        // Read the SQL file
        const sqlPath = path_1.default.join(__dirname, 'update-schema.sql');
        const sqlContent = fs_1.default.readFileSync(sqlPath, 'utf8');
        // Split by semicolon and execute each statement
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt.includes('ALTER') || stmt.includes('CREATE') || stmt.includes('INSERT'));
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
                await database_1.default.query(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            }
        }
        console.log('✅ Database schema update completed successfully!');
        console.log('📊 Updated agents table with location fields (state, country)');
        console.log('🔧 Created necessary indexes for better performance');
        console.log('👤 Inserted default admin user (username: admin, password: password)');
        console.log('🏢 Inserted sample agents with location data');
    }
    catch (error) {
        console.error('❌ Database schema update failed:', error);
        process.exit(1);
    }
    finally {
        await database_1.default.end();
    }
}
// Run the update
updateSchema();
