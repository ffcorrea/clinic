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
