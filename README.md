# clinic

Bot de WhatsApp (Z-API + DigitalOcean Serverless Inference) para varios consultorios.

## Tipos de clinica (prompts)

Cada tipo tem um modelo de prompt em `src/prompts/`: `odontologica.md`, `medica.md`, `nutricao.md`.
Os `{{campos}}` do modelo sao preenchidos com os dados de cada consultorio (tela Configuracao do painel).
Para criar um tipo novo, adicione `src/prompts/<tipo>.md`.

## Adicionar um consultorio

Como admin, em **Clinicas → Nova clinica**: nome, tipo, profissional, Instagram, tratamentos e as credenciais
da Z-API (ID da instancia, token e Client-Token, guardados criptografados no banco). Depois, na pagina da
clinica: leia o QR Code se o numero estiver desconectado, clique em **Conectar webhook** (pelo painel publicado)
e ajuste a Configuracao. O bot passa a atender em ate 1 minuto, sem deploy. Desativar a clinica para o bot.

Defina `CREDENTIALS_KEY` (um texto longo e aleatorio) nas variaveis do servidor antes de cadastrar a primeira
clinica. Sem ela a chave e derivada do `WEBHOOK_SECRET`; trocar a chave depois exige cadastrar os tokens de novo.

## Rotas

Todas exigem `?token=WEBHOOK_SECRET` ou o header `x-api-key`.

- `GET /clinics` - consultorios carregados
- `/zapi/<id>/...` - envio de mensagens, status, QR code, pausar/retomar bot
- `POST /agent/<id>/chat` - testar o agente sem WhatsApp
- `POST /zapi/webhook` - webhook antigo; acha o consultorio pelo `instanceId` da Z-API

## Painel (dashboard/)

Next.js em `dashboard/`, servido pelo bot em `/painel`. Login por e-mail e senha.

- **Agenda** - calendario de semana e mes; criar, editar, remarcar e marcar como compareceu/faltou/cancelado.
  O bot tambem marca e cancela pelo WhatsApp (aparece como "Bot").
  "Bloquear horario": fecha um periodo em um ou mais dias (compromisso, ausencia) ou dias inteiros;
  o bot nao oferece horario bloqueado. Almoco fixo vai no expediente da Configuracao (09:00-12:00, 13:00-18:00).
- **Recados** - o que o bot anotou para a recepcao responder (valores, procedimento fora da lista, convenio,
  urgencia), com link para o WhatsApp do paciente e botao "Resolvido". O menu mostra quantos estao em aberto.
- **Configuracao** - nome, tipo, profissional, tratamentos, Instagram, observacoes e a agenda
  (expediente por dia, duracao padrao, antecedencia, dias bloqueados).
  Cada tratamento pode ter duracao propria (tabela na tela). Os horarios oferecidos seguem a duracao do
  tratamento, a partir do inicio do expediente, encaixando logo apos as consultas ja marcadas.
  O bot usa em ate 1 minuto, sem deploy.
- **Uso e custos** - mensagens, tokens e custo por dia/semana/mes (admin: todas as clinicas; clinica: so a dela).
- **Usuarios** - admin cria logins de admin ou de qualquer clinica; usuario de clinica gerencia so os da propria clinica.
- **Clinicas** (so admin) - cadastro de clinicas e do WhatsApp de cada uma.

Primeiro acesso: com o banco sem usuarios, entre com `DASHBOARD_USER` / `DASHBOARD_PASSWORD`; isso cria o
primeiro administrador. Depois os logins sao gerenciados em Usuarios.

O bot cria as tabelas sozinho ao iniciar (`usage_events`, `clinics`, `users`, `appointments`, `contact_requests`). Todos os
consultorios ficam na tabela `clinics` (nao ha mais arquivos de configuracao); o bot le a tabela a cada 30s.

Variaveis:

- `DATABASE_URL` - MySQL da DigitalOcean, `mysql://usuario:senha@host:25060/banco` (obrigatoria)
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
