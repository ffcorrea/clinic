import mysql from 'mysql2/promise';

// Reaproveita o pool entre recarregamentos do dev server
const globalForDb = globalThis;

// DATABASE_URL=mysql://usuario:senha@host:porta/banco (o banco gerenciado exige SSL)
export const pool =
  globalForDb.mysqlPool ||
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 3,
    timezone: 'Z',
  });

if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool;
