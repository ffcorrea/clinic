const mysql = require('mysql2/promise');

// MySQL (DigitalOcean): uso do bot, configuracao das clinicas, usuarios do painel e agenda.
// DATABASE_URL=mysql://usuario:senha@host:porta/banco (o banco gerenciado exige SSL).
// Obrigatorio: os consultorios (e o WhatsApp de cada um) ficam na tabela clinics.
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
    role          varchar(20) NOT NULL COMMENT 'admin | clinic_admin | clinic',
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
  // Recados do bot para a recepcao (valores, procedimento fora da lista, convenio, urgencia...)
  `CREATE TABLE IF NOT EXISTS contact_requests (
    id           bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id    varchar(100) NOT NULL,
    phone        varchar(30),
    patient_name varchar(255),
    reason       varchar(30) NOT NULL COMMENT 'valores | procedimento | convenio | urgencia | outro',
    details      text,
    status       varchar(20) NOT NULL DEFAULT 'open' COMMENT 'open | done',
    created_at   datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    resolved_at  datetime,
    KEY contact_requests_clinic_idx (clinic_id, status, created_at)
  )`,
  // Cadastro de clientes. phone_key compara telefones (src/services/clients.service.js); nao e unico porque
  // uma familia pode usar o mesmo WhatsApp
  `CREATE TABLE IF NOT EXISTS clients (
    id         bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id  varchar(100) NOT NULL,
    name       varchar(255) NOT NULL,
    phone      varchar(30) NOT NULL,
    phone_key  varchar(30) NOT NULL,
    cpf        varchar(11),
    birth_date date,
    cep        varchar(9),
    address    text,
    notes      text,
    source     varchar(20) NOT NULL DEFAULT 'manual' COMMENT 'manual | agent | import',
    created_at datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    updated_at datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    UNIQUE KEY clients_cpf_idx (clinic_id, cpf),
    KEY clients_phone_idx (clinic_id, phone_key),
    KEY clients_name_idx (clinic_id, name)
  )`,
  // Atendimentos (orcamentos). O status sai das partes enviadas e dos pagamentos (dashboard/lib/quotes.js)
  `CREATE TABLE IF NOT EXISTS quotes (
    id              bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    clinic_id       varchar(100) NOT NULL,
    client_id       bigint unsigned NOT NULL,
    status          varchar(20) NOT NULL DEFAULT 'orcamento' COMMENT 'orcamento | enviado | aceito | pago',
    service_date    date NOT NULL,
    complaint       text,
    notes           text,
    token           varchar(64) CHARACTER SET ascii COLLATE ascii_bin COMMENT 'link publico do orcamento',
    created_at      datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    sent_at         datetime,
    accepted_at     datetime,
    paid_at         datetime,
    payment_methods varchar(255),
    UNIQUE KEY quotes_token_idx (token),
    KEY quotes_clinic_idx (clinic_id, status),
    KEY quotes_client_idx (clinic_id, client_id)
  )`,
  // Partes do orcamento enviadas ao cliente para aprovacao; so uma pode estar aguardando por vez
  `CREATE TABLE IF NOT EXISTS quote_sends (
    id          bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quote_id    bigint unsigned NOT NULL,
    part        int NOT NULL,
    sent_at     datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    accepted_at datetime,
    UNIQUE KEY quote_sends_part_idx (quote_id, part)
  )`,
  `CREATE TABLE IF NOT EXISTS quote_items (
    id         bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quote_id   bigint unsigned NOT NULL,
    send_id    bigint unsigned COMMENT 'NULL = ainda nao enviado ao cliente',
    kind       varchar(20) NOT NULL COMMENT 'tratamento | material',
    description text NOT NULL,
    quantity   double NOT NULL DEFAULT 1,
    unit_cents int NOT NULL DEFAULT 0,
    sort_order int NOT NULL DEFAULT 0,
    KEY quote_items_quote_idx (quote_id),
    KEY quote_items_send_idx (send_id)
  )`,
  // Pagamentos: o cliente pode pagar em partes. item_id = pagamento de um item especifico
  `CREATE TABLE IF NOT EXISTS quote_payments (
    id           bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quote_id     bigint unsigned NOT NULL,
    item_id      bigint unsigned,
    paid_on      date NOT NULL,
    amount_cents int NOT NULL,
    method       varchar(50) NOT NULL,
    note         varchar(255),
    created_at   datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    UNIQUE KEY quote_payments_item_idx (item_id),
    KEY quote_payments_quote_idx (quote_id)
  )`,
  // Comprovante do aceite. content guarda o texto exato que gerou content_hash (por isso nao e json)
  `CREATE TABLE IF NOT EXISTS quote_acceptances (
    id           bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
    quote_id     bigint unsigned NOT NULL,
    send_id      bigint unsigned NOT NULL,
    accepted_at  datetime NOT NULL DEFAULT (UTC_TIMESTAMP()),
    ip           varchar(100),
    user_agent   text,
    language     varchar(300),
    timezone     varchar(64),
    screen       varchar(32),
    platform     varchar(64),
    content      longtext NOT NULL,
    content_hash char(64) NOT NULL,
    KEY quote_acceptances_quote_idx (quote_id)
  )`,
];

// Colunas adicionadas depois da criacao das tabelas (MySQL 8 nao tem ADD COLUMN IF NOT EXISTS)
const COLUMNS = {
  clinics: {
    // Clinicas cadastradas pelo painel: WhatsApp (Z-API) no banco; tokens criptografados (src/lib/secret-box.js)
    zapi_instance_id: 'varchar(100)',
    zapi_token: 'text',
    zapi_client_token: 'text',
    active: 'tinyint(1) NOT NULL DEFAULT 1',
  },
  appointments: {
    // Cliente da consulta (achado ou criado pelo telefone); a chave entra junto com a coluna
    client_id: 'bigint unsigned, ADD KEY appointments_client_idx (clinic_id, client_id)',
  },
};

async function addMissingColumns() {
  for (const [table, columns] of Object.entries(COLUMNS)) {
    const [rows] = await pool.query(
      'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table]
    );
    const existing = new Set(rows.map((r) => r.name));
    for (const [column, definition] of Object.entries(columns)) {
      if (!existing.has(column)) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

async function createSchema() {
  for (const statement of SCHEMA) await pool.query(statement);
  await addMissingColumns();
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
