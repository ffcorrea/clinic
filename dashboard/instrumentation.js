import { safePath } from './lib/log';

// Todo erro inesperado no servidor do painel: paginas, server actions e proxy.
// O digest e o codigo que a tela mostra ao usuario; serve para achar o erro aqui no log.
export async function onRequestError(error, request, context) {
  const { code, digest, stack } = error;
  console.error(
    `[painel] erro ${context.routeType} ${request.method} ${safePath(request.path)} (${context.routePath})`,
    code ? `codigo=${code}` : '',
    digest ? `digest=${digest}` : '',
    `\n${stack || error}`
  );
}
