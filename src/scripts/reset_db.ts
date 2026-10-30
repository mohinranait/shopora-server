import 'dotenv/config';
import pg from 'pg';

async function resetDb() {
  const { Client } = pg;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');
    await client.query('DROP SCHEMA public CASCADE;');
    console.log('Dropped schema public CASCADE.');
    await client.query('CREATE SCHEMA public;');
    console.log('Created schema public.');
    console.log('Database reset complete!');
  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetDb();
