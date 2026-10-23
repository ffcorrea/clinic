# clinic

Bot de WhatsApp (Z-API + DigitalOcean Serverless Inference) para varios consultorios.

## Adicionar um consultorio

1. Crie a pasta `src/clinics/<id>/` (o `<id>` vai na URL, ex: `clinica-centro`).
2. Crie `config.json` com os NOMES das variaveis de ambiente da Z-API desse numero:
   ```json
   {
     "name": "Clinica Centro",
     "zapi": {
       "instanceIdEnv": "CLINICA_CENTRO_ZAPI_INSTANCE_ID",
       "tokenEnv": "CLINICA_CENTRO_ZAPI_TOKEN",
       "clientTokenEnv": "CLINICA_CENTRO_ZAPI_CLIENT_TOKEN"
     }
   }
   ```
   Opcional: `"model"` para usar um modelo diferente de `INFERENCE_MODEL`.
3. Crie `prompt.md` com o prompt do agente desse consultorio.
4. Defina as variaveis no `.env` / painel de deploy e reinicie o servidor.
5. Aponte o webhook da Z-API: `POST /zapi/<id>/setup-webhook` com `{ "url": "https://seu-dominio.com" }`.

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
