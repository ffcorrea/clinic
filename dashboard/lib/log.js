// Logs do painel (saem no terminal e nos Runtime Logs do App Platform).
// Sem query string, que traz dados do cliente, e sem o token do link publico, que da acesso ao orcamento.
export const safePath = (path) => String(path || '').split('?')[0].replace(/(\/orcamento\/)[^/]+/, '$1***');

// Acao recusada por regra ou validacao: a tela mostra a mensagem, o erro nao e do sistema
export function logRefused(where, message) {
  console.warn(`[painel] recusado ${where}: ${message}`);
}
