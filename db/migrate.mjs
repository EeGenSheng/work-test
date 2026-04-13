import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';

const migrationsDir = path.resolve(process.cwd(), 'db/migrations');

function isSqlFile(fileName) {
  return fileName.toLowerCase().endsWith('.sql');
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationFiles = (await readdir(migrationsDir)).filter(isSqlFile).sort((a, b) => a.localeCompare(b));

    if (migrationFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const fileName of migrationFiles) {
      const existing = await client.query('SELECT name FROM schema_migrations WHERE name = $1 LIMIT 1', [fileName]);

      if (existing.rows[0]) {
        console.log(`Skipping ${fileName} (already applied)`);
        continue;
      }

      const filePath = path.join(migrationsDir, fileName);
      const sql = await readFile(filePath, 'utf8');

      console.log(`Applying ${fileName}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [fileName]);
        await client.query('COMMIT');
        console.log(`Applied ${fileName}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
