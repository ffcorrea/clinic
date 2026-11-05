// Formatos das telas de clientes e atendimentos. Sem banco: tambem roda no navegador.

export const STATUS_LABEL = { orcamento: 'Orçamento', enviado: 'Enviado', aceito: 'Aceito', pago: 'Pago' };
export const PAYMENT_METHODS = ['PIX', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto'];

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatBRL = (cents) => brl.format(cents / 100);

// Aceita "1.500,00", "1500,5" ou "1500.50"; retorna centavos, ou null se for invalido
export function parseCents(value) {
  const clean = String(value || '').replace(/[R$\s]/g, '');
  if (!clean) return 0;
  const number = Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

export const centsToInput = (cents) => (cents / 100).toFixed(2).replace('.', ',');

// "2026-11-05" -> "05/11/2026"
export const formatDate = (date) => (date ? date.split('-').reverse().join('/') : '—');

export const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

// ---- Telefone ----
// Mesma regra de src/services/clients.service.js (manter em sincronia)

// Formato do WhatsApp (55 + DDD + numero). Id interno do WhatsApp (ex: "123@lid") nao e telefone.
export function normalizePhone(value) {
  const text = String(value || '');
  if (text.includes('@')) return '';
  const digits = onlyDigits(text);
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

// O WhatsApp pode trazer celular brasileiro com ou sem o nono digito: compara DDI + DDD + 8 ultimos
export function phoneKey(value) {
  const digits = normalizePhone(value);
  return /^55\d{10,11}$/.test(digits) ? `${digits.slice(0, 4)}${digits.slice(-8)}` : digits;
}

// "5511912345678" -> "(11) 91234-5678"
export function formatPhone(value) {
  const digits = onlyDigits(value).replace(/^55(?=\d{10,11}$)/, '');
  if (digits.length < 3 || digits.length > 11) return digits;
  const split = digits.length > 10 ? 7 : 6;
  return digits.length <= split ? `(${digits.slice(0, 2)}) ${digits.slice(2)}` : `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

export const normalizeName = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Quem desta lista tem esse nome? Nome igual ou, se nao houver, mesmo primeiro nome ("Maria" = "Maria Silva")
export function pickClient(list, name) {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const first = wanted.split(/\s+/)[0];
  return (
    list.find((c) => normalizeName(c.name) === wanted) ||
    list.find((c) => normalizeName(c.name).split(/\s+/)[0] === first) ||
    null
  );
}

// ---- Documentos ----

export function maskCpf(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCep(value) {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// Confere os dois digitos verificadores
export function isValidCpf(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(d[i]) * (size + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[size])) return false;
  }
  return true;
}

// ---- Busca ----

// Cada palavra precisa aparecer em algum campo; ignora maiusculas e acentos e compara numeros so pelos digitos
export function matchesSearch(fields, search) {
  const words = normalizeName(search).split(/\s+/).filter(Boolean);
  const texts = fields.filter((f) => f != null && f !== '').map(String);
  const text = normalizeName(texts.join(' '));
  const digits = texts.map(onlyDigits).join(' ');
  return words.every((w) => text.includes(w) || (/^[\d\s().\-/]+$/.test(w) && digits.includes(onlyDigits(w))));
}

// ---- Itens e partes do orcamento ----

export const itemTotal = (item) => Math.round(item.quantity * item.unit_cents);
export const itemsTotal = (items) => items.reduce((sum, i) => sum + itemTotal(i), 0);
export const partName = (part) => `${part}ª parte`;

// Separa os itens pelas partes enviadas ao cliente e os ainda nao enviados
export function splitParts(quote) {
  const parts = quote.sends.map((send) => {
    const items = quote.items.filter((i) => i.send_id === send.id);
    return { ...send, items, total_cents: itemsTotal(items) };
  });
  return {
    parts,
    pending: parts.find((p) => !p.accepted_at) || null,
    unsent: quote.items.filter((i) => i.send_id === null),
  };
}
