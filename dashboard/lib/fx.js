// Cotacao atual do dolar em R$. Tenta as fontes em ordem e guarda so resposta valida
// (antes o cache do Next guardava ate resposta de erro por 1h).
const CACHE_MS = 60 * 60 * 1000;

const SOURCES = [
  {
    name: 'AwesomeAPI',
    url: 'https://economia.awesomeapi.com.br/json/last/USD-BRL',
    parse: (data) => parseFloat(data?.USDBRL?.bid),
  },
  {
    name: 'Frankfurter',
    url: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL',
    parse: (data) => data?.rates?.BRL,
  },
  {
    name: 'ExchangeRate-API',
    url: 'https://open.er-api.com/v6/latest/USD',
    parse: (data) => data?.rates?.BRL,
  },
];

const globalForFx = globalThis;
globalForFx.usdBrl ??= null;

async function fetchRate() {
  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rate = Number(source.parse(await res.json()));
      if (rate > 0) return { rate, source: source.name, at: new Date() };
      throw new Error('resposta sem cotacao');
    } catch (error) {
      console.error(`Cotacao do dolar: ${source.name} falhou (${error.message})`);
    }
  }
  return null;
}

export async function getCurrentUsdBrl() {
  const cached = globalForFx.usdBrl;
  if (cached && Date.now() - cached.at.getTime() < CACHE_MS) return cached;

  const fresh = await fetchRate();
  if (fresh) globalForFx.usdBrl = fresh;

  // Se todas falharem, mostra a ultima cotacao conhecida (ou null)
  return fresh || cached;
}
