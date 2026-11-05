import crypto from 'node:crypto';
import { pool, transaction } from './db';
import { PAYMENT_METHODS, formatBRL, itemTotal, itemsTotal, parseCents } from './format';
import { isIsoDate, today } from './time';

// Atendimentos (orcamentos): tabelas quotes, quote_sends, quote_items, quote_payments e quote_acceptances,
// criadas pelo bot em src/db.js. O cliente aprova por partes, pelo link publico; o que ele aceitou e o que deve.

const MAX_CENTS = 2000000000; // limite da coluna int

const COLUMNS = `q.id, q.clinic_id, q.client_id, q.status, DATE_FORMAT(q.service_date, '%Y-%m-%d') AS service_date,
  q.complaint, q.notes, q.token, q.created_at, q.sent_at, q.accepted_at, q.paid_at, q.payment_methods`;

const TOTAL_SQL = `CAST(COALESCE((SELECT SUM(ROUND(i.quantity * i.unit_cents)) FROM quote_items i WHERE i.quote_id = q.id), 0) AS SIGNED)`;

// Soma das partes ja aceitas pelo cliente: e o que ele deve pagar
const APPROVED_SQL = `CAST(COALESCE((SELECT SUM(ROUND(i.quantity * i.unit_cents))
    FROM quote_items i JOIN quote_sends s ON s.id = i.send_id
   WHERE i.quote_id = q.id AND s.accepted_at IS NOT NULL), 0) AS SIGNED)`;

const PAID_SQL = `CAST(COALESCE((SELECT SUM(p.amount_cents) FROM quote_payments p WHERE p.quote_id = q.id), 0) AS SIGNED)`;

// Violacao de regra dentro de uma transacao: desfaz tudo e vira mensagem para a tela
class RuleError extends Error {}

/** Roda fn numa transacao. Retorna { value } ou { error } (RuleError). */
async function withRules(fn) {
  try {
    return { value: await transaction(fn) };
  } catch (error) {
    if (error instanceof RuleError) return { error: error.message };
    throw error;
  }
}

/**
 * O status sai das partes e dos pagamentos: parte aguardando aprovacao = Enviado; nada aprovado = Orcamento;
 * aprovado e todo pago = Pago; senao, Aceito.
 */
async function recalcStatus(conn, quoteId) {
  const [[q]] = await conn.query(
    `SELECT EXISTS(SELECT 1 FROM quote_sends s WHERE s.quote_id = q.id AND s.accepted_at IS NULL) AS pending,
            ${APPROVED_SQL} AS approved, ${PAID_SQL} AS paid
       FROM quotes q WHERE q.id = ?`,
    [quoteId]
  );
  const status = Number(q.pending) ? 'enviado' : !q.approved ? 'orcamento' : q.paid >= q.approved ? 'pago' : 'aceito';
  if (status === 'pago') {
    await conn.query(
      `UPDATE quotes SET status = 'pago', paid_at = COALESCE(paid_at, UTC_TIMESTAMP()),
              payment_methods = (SELECT GROUP_CONCAT(DISTINCT method ORDER BY method SEPARATOR ', ') FROM quote_payments WHERE quote_id = ?)
        WHERE id = ?`,
      [quoteId, quoteId]
    );
  } else {
    await conn.query('UPDATE quotes SET status = ?, paid_at = NULL, payment_methods = NULL WHERE id = ?', [status, quoteId]);
  }
}

// ---- Leitura ----

export async function listQuotes(clinicId, { status, clientId } = {}) {
  const where = ['q.clinic_id = ?'];
  const params = [clinicId];
  if (status) {
    where.push('q.status = ?');
    params.push(status);
  }
  if (clientId) {
    where.push('q.client_id = ?');
    params.push(clientId);
  }
  const [rows] = await pool.query(
    `SELECT ${COLUMNS}, c.name AS client_name, c.phone AS client_phone,
            ${TOTAL_SQL} AS total_cents, ${APPROVED_SQL} AS approved_cents, ${PAID_SQL} AS paid_cents
       FROM quotes q JOIN clients c ON c.id = q.client_id
      WHERE ${where.join(' AND ')} ORDER BY q.id DESC LIMIT 500`,
    params
  );
  return rows;
}

export async function countByStatus(clinicId) {
  const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM quotes WHERE clinic_id = ? GROUP BY status', [clinicId]);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.total)]));
}

async function complete(quote) {
  const [[[client]], [items], [sends], [payments]] = await Promise.all([
    pool.query('SELECT id, name, phone FROM clients WHERE id = ?', [quote.client_id]),
    pool.query('SELECT id, quote_id, send_id, description, quantity, unit_cents FROM quote_items WHERE quote_id = ? ORDER BY sort_order, id', [quote.id]),
    pool.query('SELECT id, part, sent_at, accepted_at FROM quote_sends WHERE quote_id = ? ORDER BY part', [quote.id]),
    pool.query(
      "SELECT id, item_id, DATE_FORMAT(paid_on, '%Y-%m-%d') AS paid_on, amount_cents, method, note FROM quote_payments WHERE quote_id = ? ORDER BY paid_on, id",
      [quote.id]
    ),
  ]);
  const accepted = new Set(sends.filter((s) => s.accepted_at).map((s) => s.id));
  return {
    ...quote,
    client,
    items,
    sends,
    payments,
    total_cents: itemsTotal(items),
    approved_cents: itemsTotal(items.filter((i) => accepted.has(i.send_id))),
    paid_cents: payments.reduce((sum, p) => sum + p.amount_cents, 0),
  };
}

export async function getQuote(clinicId, id) {
  const [[row]] = await pool.query(`SELECT ${COLUMNS} FROM quotes q WHERE q.id = ? AND q.clinic_id = ?`, [id, clinicId]);
  return row ? complete(row) : null;
}

// Link publico: o token e a unica credencial do cliente
export async function getQuoteByToken(token) {
  const [[row]] = await pool.query(`SELECT ${COLUMNS} FROM quotes q WHERE q.token = ?`, [token]);
  return row ? complete(row) : null;
}

export async function listAcceptances(quoteId) {
  const [rows] = await pool.query(
    'SELECT id, send_id, accepted_at, ip, user_agent, language, timezone, screen, platform, content_hash FROM quote_acceptances WHERE quote_id = ? ORDER BY id',
    [quoteId]
  );
  return rows;
}

// ---- Cadastro ----

/** Le e valida o formulario. Retorna { data } ou { error }. */
export function parseQuoteForm(form) {
  const clientId = Number(form.get('client_id'));
  const serviceDate = String(form.get('service_date') || '');
  if (!Number.isInteger(clientId) || !clientId) return { error: 'Selecione o cliente.' };
  if (!isIsoDate(serviceDate)) return { error: 'Informe a data do atendimento.' };

  let lines;
  try {
    lines = JSON.parse(String(form.get('items') || '[]'));
    if (!Array.isArray(lines)) throw new Error();
  } catch {
    return { error: 'Itens inválidos.' };
  }

  const items = [];
  for (const line of lines) {
    const description = String(line.description ?? '').trim();
    const value = String(line.value ?? '').trim();
    if (!description && !value) continue; // linha em branco
    if (!description) return { error: 'Informe a descrição de cada tratamento.' };
    const quantity = Number(String(line.quantity ?? '1').replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: `Quantidade inválida em "${description}".` };
    const unitCents = parseCents(value);
    if (unitCents === null || quantity * unitCents > MAX_CENTS) return { error: `Valor inválido em "${description}".` };
    items.push({ description, quantity, unitCents });
  }

  const text = (name) => String(form.get(name) || '').trim() || null;
  return { data: { clientId, serviceDate, complaint: text('complaint'), notes: text('notes'), items } };
}

/** Grava o atendimento (id vazio = novo). Itens ja enviados ao cliente nao mudam. Retorna { value: id } ou { error }. */
export function saveQuote(clinicId, id, data) {
  return withRules(async (conn) => {
    const [[client]] = await conn.query('SELECT id FROM clients WHERE id = ? AND clinic_id = ?', [data.clientId, clinicId]);
    if (!client) throw new RuleError('Selecione um cliente válido.');

    let order = 0;
    if (id) {
      const [[quote]] = await conn.query(
        `SELECT q.client_id, (SELECT COUNT(*) FROM quote_sends s WHERE s.quote_id = q.id) AS sends
           FROM quotes q WHERE q.id = ? AND q.clinic_id = ? FOR UPDATE`,
        [id, clinicId]
      );
      if (!quote) throw new RuleError('Atendimento não encontrado.');
      if (quote.sends > 0 && quote.client_id !== data.clientId) {
        throw new RuleError('Este orçamento já foi enviado: não é possível trocar o cliente.');
      }
      await conn.query('UPDATE quotes SET client_id = ?, service_date = ?, complaint = ?, notes = ? WHERE id = ?', [
        data.clientId,
        data.serviceDate,
        data.complaint,
        data.notes,
        id,
      ]);
      await conn.query('DELETE FROM quote_items WHERE quote_id = ? AND send_id IS NULL', [id]);
      const [[{ next }]] = await conn.query('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM quote_items WHERE quote_id = ?', [id]);
      order = Number(next);
    } else {
      const [result] = await conn.query('INSERT INTO quotes (clinic_id, client_id, service_date, complaint, notes) VALUES (?, ?, ?, ?, ?)', [
        clinicId,
        data.clientId,
        data.serviceDate,
        data.complaint,
        data.notes,
      ]);
      id = result.insertId;
    }

    // Provisorio: bancos criados antes de sair a opcao de materiais ainda exigem a coluna kind.
    // Remover este desvio depois de rodar ALTER TABLE quote_items DROP COLUMN kind.
    const [legacyKind] = await conn.query("SHOW COLUMNS FROM quote_items LIKE 'kind'");
    const kindColumn = legacyKind.length ? ", kind = 'tratamento'" : '';

    for (const item of data.items) {
      await conn.query(`INSERT INTO quote_items SET quote_id = ?, description = ?, quantity = ?, unit_cents = ?, sort_order = ?${kindColumn}`, [
        id,
        item.description,
        item.quantity,
        item.unitCents,
        order++,
      ]);
    }
    return id;
  });
}

// FOR UPDATE: duas acoes ao mesmo tempo na mesma ficha nao passam uma por cima da outra
async function lockQuote(conn, clinicId, id) {
  const [[quote]] = await conn.query(
    `SELECT q.id, q.token, ${APPROVED_SQL} AS approved, ${PAID_SQL} AS paid FROM quotes q WHERE q.id = ? AND q.clinic_id = ? FOR UPDATE`,
    [id, clinicId]
  );
  if (!quote) throw new RuleError('Atendimento não encontrado.');
  return quote;
}

// ---- Envio ao cliente ----

/** Envia os itens escolhidos como uma nova parte e gera (ou reaproveita) o link publico. */
export function sendItems(clinicId, quoteId, itemIds) {
  const ids = [...new Set(itemIds.map(Number))].filter(Number.isInteger);
  if (!ids.length) return { error: 'Escolha ao menos um item para enviar.' };
  return withRules(async (conn) => {
    const quote = await lockQuote(conn, clinicId, quoteId);
    const [waiting] = await conn.query('SELECT 1 FROM quote_sends WHERE quote_id = ? AND accepted_at IS NULL', [quoteId]);
    if (waiting.length) throw new RuleError('Já há uma parte aguardando aprovação. Espere o cliente aceitar ou cancele o envio.');

    const [unsent] = await conn.query('SELECT id FROM quote_items WHERE quote_id = ? AND send_id IS NULL AND id IN (?)', [quoteId, ids]);
    if (unsent.length !== ids.length) throw new RuleError('Alguns itens já foram enviados ou removidos. Recarregue a página.');

    const [[{ next }]] = await conn.query('SELECT COALESCE(MAX(part), 0) + 1 AS next FROM quote_sends WHERE quote_id = ?', [quoteId]);
    const [send] = await conn.query('INSERT INTO quote_sends (quote_id, part) VALUES (?, ?)', [quoteId, next]);
    await conn.query('UPDATE quote_items SET send_id = ? WHERE quote_id = ? AND id IN (?)', [send.insertId, quoteId, ids]);
    await conn.query('UPDATE quotes SET token = ?, sent_at = UTC_TIMESTAMP() WHERE id = ?', [
      quote.token || crypto.randomBytes(18).toString('base64url'),
      quoteId,
    ]);
    await recalcStatus(conn, quoteId);
  });
}

/** Cancela a parte que aguarda aprovacao: os itens voltam a ser editaveis. */
export function cancelSend(clinicId, quoteId) {
  return withRules(async (conn) => {
    await lockQuote(conn, clinicId, quoteId);
    await conn.query(
      `UPDATE quote_items i JOIN quote_sends s ON s.id = i.send_id SET i.send_id = NULL
        WHERE s.quote_id = ? AND s.accepted_at IS NULL`,
      [quoteId]
    );
    await conn.query('DELETE FROM quote_sends WHERE quote_id = ? AND accepted_at IS NULL', [quoteId]);
    await recalcStatus(conn, quoteId);
  });
}

/** Exclui um item. Aguardando aprovacao exige cancelar o envio; pago exige excluir o pagamento. */
export function deleteItem(clinicId, quoteId, itemId) {
  return withRules(async (conn) => {
    await lockQuote(conn, clinicId, quoteId);
    const [[item]] = await conn.query(
      `SELECT i.send_id, s.accepted_at, EXISTS(SELECT 1 FROM quote_payments p WHERE p.item_id = i.id) AS paid
         FROM quote_items i LEFT JOIN quote_sends s ON s.id = i.send_id
        WHERE i.id = ? AND i.quote_id = ?`,
      [itemId, quoteId]
    );
    if (!item) return;
    if (item.send_id && !item.accepted_at) throw new RuleError('Este item está aguardando aprovação do cliente. Cancele o envio para excluí-lo.');
    if (Number(item.paid)) throw new RuleError('Este item está pago. Exclua o pagamento antes.');

    await conn.query('DELETE FROM quote_items WHERE id = ?', [itemId]);
    const quote = await lockQuote(conn, clinicId, quoteId);
    if (quote.paid > quote.approved) {
      throw new RuleError(`Sem este item, o aprovado (${formatBRL(quote.approved)}) fica menor que o já pago (${formatBRL(quote.paid)}). Exclua um pagamento antes.`);
    }
    await recalcStatus(conn, quoteId);
  });
}

// ---- Pagamentos ----

/** Registra um pagamento das partes ja aceitas: valor livre, ou de um item (itemId), com o valor dele. */
export function addPayment(clinicId, quoteId, { itemId, amount, paidOn, method, note }) {
  if (!isIsoDate(paidOn)) return { error: 'Informe a data do pagamento.' };
  if (paidOn > today()) return { error: 'A data do pagamento não pode ser no futuro.' };
  if (!PAYMENT_METHODS.includes(method)) return { error: 'Selecione a forma de pagamento.' };

  return withRules(async (conn) => {
    const quote = await lockQuote(conn, clinicId, quoteId);
    if (!quote.approved) throw new RuleError('Registre pagamentos depois que o cliente aceitar o orçamento.');
    const missing = quote.approved - quote.paid;
    if (missing <= 0) throw new RuleError('O que o cliente aprovou já está totalmente pago.');

    let cents = parseCents(amount);
    let description = note;
    if (itemId) {
      const [[item]] = await conn.query(
        `SELECT i.description, i.quantity, i.unit_cents, s.accepted_at,
                EXISTS(SELECT 1 FROM quote_payments p WHERE p.item_id = i.id) AS paid
           FROM quote_items i LEFT JOIN quote_sends s ON s.id = i.send_id
          WHERE i.id = ? AND i.quote_id = ?`,
        [itemId, quoteId]
      );
      if (!item?.accepted_at) throw new RuleError('Só é possível pagar itens já aceitos pelo cliente.');
      if (Number(item.paid)) throw new RuleError('Este item já está pago.');
      cents = itemTotal(item);
      description = note || item.description.slice(0, 255);
    }
    if (!cents) throw new RuleError('Informe o valor recebido.');
    if (cents > missing) throw new RuleError(`O valor passa do que falta pagar (${formatBRL(missing)}).`);

    await conn.query('INSERT INTO quote_payments (quote_id, item_id, paid_on, amount_cents, method, note) VALUES (?, ?, ?, ?, ?, ?)', [
      quoteId,
      itemId || null,
      paidOn,
      cents,
      method,
      description || null,
    ]);
    await recalcStatus(conn, quoteId);
  });
}

export function deletePayment(clinicId, quoteId, paymentId) {
  return withRules(async (conn) => {
    await lockQuote(conn, clinicId, quoteId);
    await conn.query('DELETE FROM quote_payments WHERE id = ? AND quote_id = ?', [paymentId, quoteId]);
    await recalcStatus(conn, quoteId);
  });
}

// ---- Aceite do cliente (publico) ----

const short = (value, max = 300) => (typeof value === 'string' && value ? value.slice(0, max) : null);

/** O cliente aceita a parte que viu na tela. Guarda o comprovante com copia exata do que foi aceito. */
export function acceptQuote(token, sendId, { ip, userAgent, acceptLanguage, browser = {} }) {
  return withRules(async (conn) => {
    const [[quote]] = await conn.query(
      `SELECT q.id, q.clinic_id, s.part, c.name, c.phone
         FROM quotes q JOIN quote_sends s ON s.quote_id = q.id JOIN clients c ON c.id = q.client_id
        WHERE q.token = ? AND s.id = ? AND s.accepted_at IS NULL FOR UPDATE`,
      [token, sendId]
    );
    if (!quote) throw new RuleError('Este orçamento não está disponível para aceite.');

    await conn.query('UPDATE quote_sends SET accepted_at = UTC_TIMESTAMP() WHERE id = ?', [sendId]);
    await conn.query('UPDATE quotes SET accepted_at = UTC_TIMESTAMP() WHERE id = ?', [quote.id]);
    await recalcStatus(conn, quote.id);

    const [items] = await conn.query('SELECT description, quantity, unit_cents FROM quote_items WHERE send_id = ? ORDER BY sort_order, id', [sendId]);
    const content = JSON.stringify({
      atendimento: quote.id,
      clinica: quote.clinic_id,
      parte: quote.part,
      cliente: quote.name,
      telefone: quote.phone,
      itens: items,
      total_cents: itemsTotal(items),
    });
    await conn.query(
      `INSERT INTO quote_acceptances (quote_id, send_id, ip, user_agent, language, timezone, screen, platform, content, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quote.id,
        sendId,
        short(ip, 100),
        short(userAgent, 500),
        short(browser.languages) ?? short(acceptLanguage),
        short(browser.timezone, 64),
        short(browser.screen, 32),
        short(browser.platform, 64),
        content,
        crypto.createHash('sha256').update(content).digest('hex'),
      ]
    );
  });
}
