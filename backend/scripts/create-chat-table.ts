import pool from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function createChatTable() {
  try {
    console.log('📝 Creating chat_messages table...');
    
    const sqlFile = path.join(__dirname, 'create-chat-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    const client = await pool.connect();
    
    try {
      await client.query(sql);
      console.log('✅ chat_messages table created successfully!');
      
      // Also set the sequence
      await client.query(
        "SELECT setval('chat_messages_id_seq', COALESCE((SELECT MAX(id) FROM chat_messages), 1))"
      );
      console.log('✅ Sequence aligned successfully!');
    } finally {
      client.release();
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating chat_messages table:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists, skipping...');
      process.exit(0);
    }
    process.exit(1);
  }
}

createChatTable();

