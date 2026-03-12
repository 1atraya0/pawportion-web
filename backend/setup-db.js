/**
 * Database Setup Script
 * Runs the schema to initialize the database
 * Usage: node setup-db.js
 */

const fs = require('fs');
const { pool } = require('./db');
require('dotenv').config();

async function setupDatabase() {
  try {
    console.log('🔧 Starting database setup...');
    let hardFailures = 0;
    
    // Read schema file
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    
    // Remove full-line comments first, then split by semicolon
    const cleanedSchema = schema
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSchema
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (err) {
        // Some statements might fail if objects already exist, that's okay
        if (err.message.includes('already exists')) {
          console.log(`ℹ️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, err.message);
          hardFailures += 1;
        }
      }
    }

    if (hardFailures > 0) {
      throw new Error(`Database setup failed with ${hardFailures} SQL errors`);
    }

    const requiredTables = [
      'device_settings',
      'feeding_logs',
      'device_status_logs',
      'feeding_schedules',
      'user_preferences',
      'activity_logs',
      'api_tokens',
      'alerts'
    ];

    const validation = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
      [requiredTables]
    );

    const foundTables = validation.rows.map((row) => row.table_name);
    const missingTables = requiredTables.filter((table) => !foundTables.includes(table));

    if (missingTables.length > 0) {
      throw new Error(`Missing tables after setup: ${missingTables.join(', ')}`);
    }
    
    console.log('\n✅ Database setup completed successfully!');
    console.log('📊 Tables created:');
    console.log('   - device_settings');
    console.log('   - feeding_logs');
    console.log('   - device_status_logs');
    console.log('   - feeding_schedules');
    console.log('   - user_preferences');
    console.log('   - activity_logs');
    console.log('   - api_tokens');
    console.log('   - alerts');
    console.log('\n🎉 Ready to use!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  }
}

setupDatabase();
