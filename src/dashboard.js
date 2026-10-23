const fs = require('fs');
const path = require('path');

// Painel de uso (Next.js em dashboard/) servido pelo proprio Express em /painel,
// para rodar bot e painel num unico componente do App Platform.
const DASHBOARD_DIR = path.join(__dirname, '..', 'dashboard');
const BASE_PATH = '/painel';

function isDashboardPath(pathname) {
  return pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`);
}

function mountDashboard(app) {
  // Sem build (ex: dev local do bot), o painel fica de fora; rode-o com `npm run dev` em dashboard/
  if (!fs.existsSync(path.join(DASHBOARD_DIR, '.next', 'BUILD_ID'))) {
    console.log('Painel nao compilado (dashboard/.next), /painel desativado');
    return;
  }

  const next = require(require.resolve('next', { paths: [DASHBOARD_DIR] }));
  const nextApp = next({ dev: false, dir: DASHBOARD_DIR });
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

    ready
      .then(() => handle(req, res))
      .catch(() => res.status(503).send('Painel indisponivel'));
  });
}

module.exports = { mountDashboard };
