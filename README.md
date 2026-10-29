# clinic

Bot de WhatsApp (Z-API + DigitalOcean Serverless Inference) para varios consultorios.

## Tipos de clinica (prompts)

Cada tipo tem um modelo de prompt em `src/prompts/`: `odontologica.md`, `medica.md`, `nutricao.md`.
Os `{{campos}}` do modelo sao preenchidos pelo bloco `prompt` do `config.json` de cada consultorio.
Para criar um tipo novo, adicione `src/prompts/<tipo>.md`.

## Adicionar um consultorio

1. Crie a pasta `src/clinics/<id>/` (o `<id>` vai na URL, ex: `instituto-lirium`).
2. Crie `config.json`:
   ```json
   {
     "name": "Instituto Lirium",
     "type": "odontologica",
     "prompt": {
       "professional": "a Dra. Fulana",
       "services": ["Lentes de contato dental", "Clareamento dental"],
       "instagram": "@institutolirium",
       "notes": ["Estacionamento no local."]
     },
     "zapi": {
       "instanceIdEnv": "LIRIUM_ZAPI_INSTANCE_ID",
       "tokenEnv": "LIRIUM_ZAPI_TOKEN",
       "clientTokenEnv": "LIRIUM_ZAPI_CLIENT_TOKEN"
     }
   }
   ```
   - `type`: nome de um arquivo em `src/prompts/` (sem `.md`)
   - `professional`: como o bot se refere a quem atende ("a Dra. Fulana", "o Dr. Paulo", "a nutricionista Ana")
   - `notes` (opcional): informacoes e regras so desse consultorio
   - `schedule` (opcional): agenda inicial (expediente, duracao da consulta); depois e editada no painel
   - `model` (opcional): modelo diferente de `INFERENCE_MODEL`
   - `zapi`: os NOMES das variaveis de ambiente da Z-API desse numero
   - Se faltar algum campo, o servidor nao inicia e diz qual falta.
3. Defina as variaveis no `.env` / painel de deploy e reinicie o servidor.
4. Aponte o webhook da Z-API: `POST /zapi/<id>/setup-webhook` com `{ "url": "https://seu-dominio.com" }`.

## Rotas

Todas exigem `?token=WEBHOOK_SECRET` ou o header `x-api-key`.

- `GET /clinics` - consultorios carregados
- `/zapi/<id>/...` - envio de mensagens, status, QR code, pausar/retomar bot
- `POST /agent/<id>/chat` - testar o agente sem WhatsApp
- `POST /zapi/webhook` - webhook antigo; acha o consultorio pelo `instanceId` da Z-API

## Painel (dashboard/)

Next.js em `dashboard/`, servido pelo bot em `/painel`. Login por e-mail e senha.

- **Agenda** - consultas da semana; criar, editar, remarcar e marcar como compareceu/faltou/cancelado.
  O bot tambem marca e cancela pelo WhatsApp (aparece como "Bot").
- **Configuracao** - nome, tipo, profissional, tratamentos, Instagram, observacoes e a agenda
  (expediente por dia, duracao padrao, antecedencia, dias bloqueados).
  Cada tratamento pode ter duracao propria (tabela na tela). Os horarios oferecidos seguem a duracao do
  tratamento, a partir do inicio do expediente, encaixando logo apos as consultas ja marcadas.
  O bot usa em ate 1 minuto, sem deploy.
- **Uso e custos** (so admin) - mensagens, tokens e custo por consultorio, por dia/semana/mes.
- **Usuarios** (so admin) - cria logins de admin ou de uma clinica (ve so a propria agenda e configuracao).

Primeiro acesso: com o banco sem usuarios, entre com `DASHBOARD_USER` / `DASHBOARD_PASSWORD`; isso cria o
primeiro administrador. Depois os logins sao gerenciados em Usuarios.

O bot cria as tabelas sozinho ao iniciar (`usage_events`, `clinics`, `users`, `appointments`) e cadastra cada
consultorio de `src/clinics/` na tabela `clinics` (so na primeira vez; dai em diante vale o que for salvo no painel).

Variaveis:

- `DATABASE_URL` - MySQL da DigitalOcean, `mysql://usuario:senha@host:25060/banco`
  (sem ela: sem agenda, sem painel e sem registro de uso; o bot responde com o config.json)
- `DASHBOARD_USER` / `DASHBOARD_PASSWORD` - so para criar o primeiro administrador
- `SESSION_SECRET` (opcional) - chave do cookie de login; sem ela e derivada dos outros segredos
- `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` - preco do modelo em US$ por 1 milhao de tokens (padrao 1 / 5)

Para rodar o painel sozinho: `cd dashboard && npm install && npm run dev` (http://localhost:3001/painel).
Atencao: o `.env` local aponta para o banco de producao.

## Deploy (App Platform, um componente so)

O Express do bot tambem serve o painel em `/painel` (Next.js como custom server, `src/dashboard.js`).

- Build command: `npm run build` (instala e compila o `dashboard/`)
- Run command: `npm start`
- Painel: `https://<seu-app>/painel` - os webhooks da Z-API continuam iguais

Sem o build do painel (ex: `npm run dev` do bot), `/painel` fica desativado; rode o painel a parte com
`cd dashboard && npm run dev`.

Se o banco tiver "Trusted sources" ativado, adicione o app do bot nele.
