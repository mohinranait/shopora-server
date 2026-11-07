import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function cleanDatabase() {
  const { Client } = pg;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Get all user tables in the public schema
    const tablesRes = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);

    const tables = tablesRes.rows.map((r: { tablename: string }) => r.tablename);
    console.log(`Found ${tables.length} tables to truncate.`);

    if (tables.length > 0) {
      // Build a single TRUNCATE statement with all tables
      const tableList = tables.map((t: string) => `"${t}"`).join(', ');
      console.log(`Executing: TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
      await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
      console.log('All tables truncated successfully.');
    }

    // Verify row counts across all tables
    console.log('\n--- Verifying Row Counts ---');
    let remainingRows = 0;
    for (const table of tables) {
      const countRes = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countRes.rows[0].count, 10);
      if (count > 0) {
        console.log(`  WARNING: ${table} still has ${count} rows`);
        remainingRows += count;
      }
    }

    if (remainingRows === 0) {
      console.log(`\n SUCCESS: Database is completely empty! (0 rows across all ${tables.length} tables)`);
    } else {
      console.log(`\n Total remaining rows: ${remainingRows}`);
    }
  } catch (err) {
    console.error('Error cleaning database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanDatabase();
