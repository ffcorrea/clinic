// Cotacao atual do dolar (AwesomeAPI). Usada so para registros sem cotacao gravada.
export async function getCurrentUsdBrl() {
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const rate = parseFloat(data?.USDBRL?.bid);
    return rate > 0 ? { rate, at: data.USDBRL.create_date } : null;
  } catch {
    return null;
  }
}
