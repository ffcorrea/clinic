const mysql = require('mysql2/promise');

// MySQL (DigitalOcean): uso do bot, configuracao das clinicas, usuarios do painel e agenda.
// DATABASE_URL=mysql://usuario:senha@host:porta/banco (o banco gerenciado exige SSL).
// Sem DATABASE_URL o bot funciona so com o config.json, sem agenda e sem registro de uso.
const DATABASE_URL = process.env.DATABASE_URL;

const pool = DATABASE_URL
  ? mysql.createPool({ uri: DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionLimit: 5, timezone: 'Z' })
  : null;

// Datas gravadas em UTC; quem exibe converte para o horario de Brasilia
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS usage_events (
    id                bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    created_at        datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    clinic_id         varchar(100) NOT NULL,
    clinic_name       varchar(255),
    phone             varchar(30),
    kind              varchar(30) NOT NULL COMMENT 'reply | error | unsupported_media',
    model             varchar(100),
    messages_in       int NOT NULL DEFAULT 0,
    messages_out      int NOT NULL DEFAULT 0,
    prompt_tokens     int NOT NULL DEFAULT 0,
    completion_tokens int NOT NULL DEFAULT 0,
    cost_usd          decimal(12, 6) NOT NULL DEFAULT 0,
    usd_brl           decimal(10, 4),
    KEY usage_events_created_at_idx (created_at),
    KEY usage_events_clinic_idx (clinic_id, created_at)
  )`,
  // Dados do prompt e da agenda de cada clinica, editaveis no painel (/painel/configuracao)
  `CREATE TABLE IF NOT EXISTS clinics (
    id         varchar(100) NOT NULL PRIMARY KEY,
    name       varchar(255) NOT NULL,
    type       varchar(30) NOT NULL,
    settings   json NOT NULL,
    updated_at datetime NOT NULL DEFAULT (UTC_TIMESTAMP())
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id            bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email         varchar(255) NOT NULL,
    name          varchar(255) NOT NULL,
    password_hash varchar(255) NOT NULL,
    role          varchar(20) NOT NULL COMMENT 'admin | clinic',
    clinic_id     varchar(100),
    active        tinyint(1) NOT NULL DEFAULT 1,
    created_at    datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    UNIQUE KEY users_email_idx (email)
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id           bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id    varchar(100) NOT NULL,
    patient_name varchar(255) NOT NULL,
    phone        varchar(30),
    service      varchar(255),
    starts_at    datetime NOT NULL,
    ends_at      datetime NOT NULL,
    status       varchar(20) NOT NULL DEFAULT 'scheduled' COMMENT 'scheduled | done | no_show | cancelled',
    source       varchar(20) NOT NULL COMMENT 'agent | manual',
    notes        text,
    created_at   datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    updated_at   datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    KEY appointments_clinic_idx (clinic_id, starts_at),
    KEY appointments_phone_idx (clinic_id, phone)
  )`,
];

async function createSchema() {
  for (const statement of SCHEMA) await pool.query(statement);
}

const ready = pool
  ? createSchema().then(
      () => true,
      (error) => {
        console.error('Erro ao preparar o banco:', error.message);
        return false;
      }
    )
  : Promise.resolve(false);

// Executa uma query; sem banco configurado ou pronto, lanca erro
async function query(sql, params) {
  if (!(await ready)) throw new Error('banco de dados indisponivel');
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Executa fn(conn) com uma trava nomeada (ex: por clinica), evitando dois agendamentos no mesmo horario
async function withLock(name, fn) {
  if (!(await ready)) throw new Error('banco de dados indisponivel');
  const conn = await pool.getConnection();
  try {
    const [[{ locked }]] = await conn.query('SELECT GET_LOCK(?, 10) AS locked', [name]);
    if (!locked) throw new Error('agenda ocupada, tente de novo');
    try {
      return await fn(conn);
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [name]);
    }
  } finally {
    conn.release();
  }
}

module.exports = {
  enabled: Boolean(pool),
  ready,
  query,
  withLock,
};
