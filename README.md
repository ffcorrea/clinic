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
       "hours": "segunda a sexta, 9h às 18h",
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

## Painel de uso (dashboard/)

O bot grava cada atendimento na tabela `usage_events` (criada sozinha ao iniciar):
mensagens recebidas/enviadas, tokens, custo em US$ e o dolar do momento (AwesomeAPI).
O painel Next.js em `dashboard/` mostra isso por consultorio, agrupado por dia, semana ou mes.

Variaveis do bot:

- `DATABASE_URL` - MySQL da DigitalOcean, `mysql://usuario:senha@host:25060/banco` (sem ela o registro fica desligado)
- `PRICE_INPUT_PER_MTOK` / `PRICE_OUTPUT_PER_MTOK` - preco do modelo em US$ por 1 milhao de tokens (padrao 1 / 5)

Painel (`cd dashboard && npm install && npm run dev`, abre em http://localhost:3001/painel).
Localmente ele le o mesmo `.env` da raiz que o bot; variaveis a mais:

- `DASHBOARD_USER` / `DASHBOARD_PASSWORD` - login do painel

## Deploy (App Platform, um componente so)

O Express do bot tambem serve o painel em `/painel` (Next.js como custom server, `src/dashboard.js`).

- Build command: `npm run build` (instala e compila o `dashboard/`)
- Run command: `npm start`
- Painel: `https://<seu-app>/painel` - os webhooks da Z-API continuam iguais

Sem o build do painel (ex: `npm run dev` do bot), `/painel` fica desativado; rode o painel a parte com
`cd dashboard && npm run dev`.

Se o banco tiver "Trusted sources" ativado, adicione o app do bot nele.
