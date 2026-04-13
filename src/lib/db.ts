import { Pool } from 'pg';

declare global {
  var __workTestPgPool: Pool | undefined;
}

export const dbPool =
  global.__workTestPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__workTestPgPool = dbPool;
}
