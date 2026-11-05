import mysql from 'mysql2/promise';

// Reaproveita o pool entre recarregamentos do dev server
const globalForDb = globalThis;

// O mysql2 poe no erro o SQL com os valores (nome, telefone, CPF) e o Next imprime o erro inteiro no log
function hideSqlInErrors(target) {
  const query = target.query.bind(target);
  target.query = (...args) =>
    query(...args).catch((error) => {
      delete error.sql;
      throw error;
    });
  return target;
}

function createPool() {
  // DATABASE_URL=mysql://usuario:senha@host:porta/banco (o banco gerenciado exige SSL)
  const created = mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 3,
    timezone: 'Z',
  });
  const getConnection = created.getConnection.bind(created);
  created.getConnection = async () => hideSqlInErrors(await getConnection());
  return hideSqlInErrors(created);
}

export const pool = globalForDb.mysqlPool || createPool();

if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool;

// Executa fn(conn) numa transacao: desfaz tudo se fn lancar erro
export async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
