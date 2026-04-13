import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';

const migrationsDir = path.resolve(process.cwd(), 'db/migrations');

async function loadLocalEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envFiles = ['.env.local', '.env'];

  for (const envFile of envFiles) {
    const filePath = path.resolve(process.cwd(), envFile);

    try {
      const contents = await readFile(filePath, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex < 0) {
          continue;
        }

        const key = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim();

        if (key === 'DATABASE_URL' && value) {
          process.env.DATABASE_URL = value;
          return;
        }
      }
    } catch {
      // Ignore missing env files and continue to the next one.
    }
  }
}

function isSqlFile(fileName) {
  return fileName.toLowerCase().endsWith('.sql');
}

async function run() {
  await loadLocalEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured. Set it in the environment or in .env/.env.local.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Some managed Postgres roles (including Neon in CI) can have an empty search_path.
    // Force public schema for this session so unqualified CREATE/SELECT statements work.
    await client.query('SET search_path TO public');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
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
      const existing = await client.query('SELECT name FROM public.schema_migrations WHERE name = $1 LIMIT 1', [fileName]);

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
        await client.query('INSERT INTO public.schema_migrations (name) VALUES ($1)', [fileName]);
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
  const message = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ''}` : String(error);
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
