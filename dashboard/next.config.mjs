import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Usa o mesmo .env da raiz do repo que o bot. No App Platform o arquivo nao existe
// e as variaveis vem do painel da DigitalOcean.
dotenv.config({ path: path.join(dir, '..', '.env'), quiet: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Roda no mesmo App Platform do bot, na rota /painel
  basePath: '/painel',
  serverExternalPackages: ['mysql2'],
  outputFileTracingRoot: dir,
  turbopack: { root: dir },
};

export default nextConfig;
