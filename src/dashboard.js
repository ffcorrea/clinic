const fs = require('fs');
const path = require('path');

// Painel de uso (Next.js em dashboard/) servido pelo proprio Express em /painel,
// para rodar bot e painel num unico componente do App Platform.
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');
const BASE_PATH = '/painel';

function isDashboardPath(pathname) {
  return pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`);
}

// Sem query string, que traz dados do cliente, e sem o token do link publico
const safePath = (pathname) => pathname.replace(/(\/orcamento\/)[^/]+/, '$1***');

function mountDashboard(app) {
  // Sem build (ex: dev local do bot), o painel fica de fora; rode-o com `npm run dev` em dashboard/
  if (!fs.existsSync(path.join(DASHBOARD_DIR, '.next', 'BUILD_ID'))) {
    console.log('Painel nao compilado (dashboard/.next), /painel desativado');
    return;
  }

  const next = require(require.resolve('next', { paths: [DASHBOARD_DIR] }));
  // Porta real: sem ela o Next busca a pagina seguinte aos formularios em localhost:3000
  const nextApp = next({ dev: false, dir: DASHBOARD_DIR, hostname: 'localhost', port: Number(process.env.PORT) || 3000 });
  const handle = nextApp.getRequestHandler();

  const ready = nextApp.prepare().then(
    () => console.log(`Painel disponivel em ${BASE_PATH}`),
    (error) => {
      console.error('Erro ao iniciar o painel:', error);
      throw error;
    }
  );

  app.use((req, res, nextMiddleware) => {
    if (!isDashboardPath(req.path)) return nextMiddleware();

    // Guarda antes: o Next tira o /painel de req.url
    const line = `${req.method} ${safePath(req.path)}`;
    res.on('finish', () => {
      if (res.statusCode >= 500) console.error(`[painel] ${res.statusCode} ${line}`);
      else if (res.statusCode >= 400) console.warn(`[painel] ${res.statusCode} ${line}`);
    });

    // Formulario enviado antes do JavaScript carregar: o Next redireciona sem o basePath
    // (ex: "/agenda" em vez de "/painel/agenda"). Corrige o Location aqui.
    const setHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) => {
      if (String(name).toLowerCase() === 'location' && typeof value === 'string' && value.startsWith('/') && !isDashboardPath(value.split('?')[0])) {
        value = `${BASE_PATH}${value}`;
      }
      return setHeader(name, value);
    };

    ready
      .then(() => handle(req, res))
      .catch((error) => {
        console.error('[painel] Erro ao atender a requisicao:', error.message);
        res.status(503).send('Painel indisponivel');
      });
  });
}

module.exports = { mountDashboard };
