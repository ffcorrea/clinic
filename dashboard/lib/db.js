import { Pool } from 'pg';

// Reaproveita o pool entre recarregamentos do dev server
const globalForPg = globalThis;

export const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;
