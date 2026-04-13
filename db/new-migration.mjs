import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'db/migrations');

function toTimestamp(date = new Date()) {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function toSlug(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

async function run() {
  const rawName = process.argv.slice(2).join(' ');
  const slug = toSlug(rawName);

  if (!slug) {
    throw new Error('Please provide a migration name. Example: npm run migrate:new -- add_invoice_indexes');
  }

  await access(migrationsDir);

  const fileName = `${toTimestamp()}_${slug}.sql`;
  const filePath = path.join(migrationsDir, fileName);

  const template = `-- ${fileName}\n-- Write forward-only SQL here.\n\n`;
  await writeFile(filePath, template, 'utf8');

  console.log(`Created ${path.relative(process.cwd(), filePath)}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to create migration: ${message}`);
  process.exitCode = 1;
});
