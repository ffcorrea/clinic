const axios = require('axios');
const db = require('../db');
const agenda = require('./agenda.service');
const clinicService = require('./clinic.service');
const time = require('../lib/time');

// Serverless Inference da DigitalOcean (API compativel com OpenAI)
const INFERENCE_ENDPOINT = process.env.INFERENCE_ENDPOINT || 'https://inference.do-ai.run';
const INFERENCE_ACCESS_KEY = process.env.INFERENCE_ACCESS_KEY;
// Teto de tokens por resposta (o prompt ja pede mensagens curtas; isto e so uma trava)
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '300', 10);
// Maximo de idas ao modelo por mensagem (cada uso de ferramenta e uma ida)
const MAX_STEPS = 5;

// Ferramentas da agenda. O telefone do paciente nunca vem do modelo: e o do WhatsApp.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'verificar_disponibilidade',
      description: 'Lista os horarios livres da agenda da clinica entre duas datas (no maximo 12 horarios).',
      parameters: {
        type: 'object',
        properties: {
          data_inicio: { type: 'string', description: 'Data inicial, YYYY-MM-DD' },
          data_fim: { type: 'string', description: 'Data final, YYYY-MM-DD (pode ser igual a inicial)' },
          periodo: { type: 'string', enum: ['manha', 'tarde', 'qualquer'], description: 'Periodo preferido pelo paciente' },
        },
        required: ['data_inicio', 'data_fim'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_consulta',
      description: 'Marca a consulta num horario livre retornado por verificar_disponibilidade. So use depois que o paciente escolher o horario.',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'YYYY-MM-DD' },
          hora: { type: 'string', description: 'HH:MM' },
          nome_paciente: { type: 'string', description: 'Nome do paciente' },
          tratamento: { type: 'string', description: 'Tratamento ou motivo da consulta' },
        },
        required: ['data', 'hora', 'nome_paciente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_consulta',
      description: 'Cancela uma consulta ja marcada deste paciente (use o id da lista de consultas do paciente).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'Id da consulta' } },
        required: ['id'],
      },
    },
  },
];

async function callModel(clinic, messages, tools) {
  const response = await axios.post(
    `${INFERENCE_ENDPOINT}/v1/chat/completions`,
    {
      model: clinic.model,
      max_tokens: MAX_TOKENS,
      // Sem raciocinio oculto: ele gastava ~5x mais tokens que a propria resposta
      thinking: { type: 'disabled' },
      ...(tools && { tools }),
      messages,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INFERENCE_ACCESS_KEY}`,
      },
    }
  );
  return response.data;
}

async function runTool(clinic, profile, phone, name, args) {
  const schedule = profile.settings.schedule;

  if (name === 'verificar_disponibilidade') {
    const period = args.periodo === 'qualquer' ? undefined : args.periodo;
    const slots = await agenda.freeSlots(clinic.id, schedule, args.data_inicio, args.data_fim, period);
    return slots.length
      ? { horarios_livres: slots.map((s) => ({ data: s.date, hora: s.time, descricao: s.label })) }
      : { horarios_livres: [], aviso: 'Nenhum horario livre nesse periodo. Ofereca verificar outras datas.' };
  }

  if (name === 'agendar_consulta') {
    const result = await agenda.book(clinic.id, schedule, {
      date: args.data,
      time: args.hora,
      patientName: args.nome_paciente,
      phone,
      service: args.tratamento,
    });
    return result.ok
      ? { agendado: true, id: result.appointment.id, quando: result.appointment.label }
      : { agendado: false, motivo: result.reason, aviso: 'Nao foi marcado. Verifique outros horarios livres.' };
  }

  if (name === 'cancelar_consulta') {
    const cancelled = await agenda.cancel(clinic.id, phone, args.id);
    return cancelled ? { cancelado: true } : { cancelado: false, motivo: 'consulta nao encontrada ou ja passou' };
  }

  return { erro: `ferramenta desconhecida: ${name}` };
}

// Contexto que muda a cada mensagem: data e hora atual e consultas ja marcadas do paciente
async function buildContext(clinic, phone, agendaOn) {
  const now = time.toLocal(new Date());
  const [year, month, day] = now.date.split('-');
  const lines = [
    '## CONTEXTO ATUAL',
    `Agora: ${time.WEEKDAYS[now.weekday]}, ${day}/${month}/${year}, ${now.time} (horário de Brasília).`,
  ];

  if (!agendaOn) {
    lines.push('A agenda está indisponível no momento: não marque nem cancele consultas. Diga que a recepção vai entrar em contato para agendar.');
    return lines.join('\n');
  }

  const upcoming = await agenda.upcoming(clinic.id, phone);
  lines.push(
    upcoming.length
      ? `Consultas já marcadas deste paciente:\n${upcoming.map((a) => `- id ${a.id}: ${a.label}${a.service ? ` (${a.service})` : ''}`).join('\n')}`
      : 'Este paciente não tem consultas marcadas.'
  );
  return lines.join('\n');
}

/**
 * Conversa com o modelo, usando as ferramentas da agenda quando ele pedir.
 * Retorna a resposta final no formato da API (choices) com o uso de tokens somado de todas as idas.
 * @param {Object} clinic - consultorio do clinic.service
 * @param {Array} messages - historico [{ role, content }]
 * @param {Object} options - { phone } telefone do paciente (para a agenda)
 */
async function chat(clinic, messages, { phone } = {}) {
  const profile = await clinicService.getProfile(clinic);
  const agendaOn = db.enabled && (await db.ready) && Boolean(phone);
  const system = `${clinicService.renderPrompt(profile)}\n\n${await buildContext(clinic, phone, agendaOn)}`;

  const conversation = [{ role: 'system', content: system }, ...messages];
  const usage = { prompt_tokens: 0, completion_tokens: 0 };
  const toolCalls = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const data = await callModel(clinic, conversation, agendaOn ? TOOLS : undefined);
    usage.prompt_tokens += data.usage?.prompt_tokens || 0;
    usage.completion_tokens += data.usage?.completion_tokens || 0;

    const message = data.choices?.[0]?.message;
    if (!message?.tool_calls?.length) return { ...data, usage, toolCalls };

    conversation.push(message);
    for (const call of message.tool_calls) {
      let result;
      try {
        const args = JSON.parse(call.function.arguments || '{}');
        result = await runTool(clinic, profile, phone, call.function.name, args);
        toolCalls.push({ name: call.function.name, args, result });
      } catch (error) {
        console.error(`[${clinic.id}] Erro na ferramenta ${call.function.name}:`, error.message);
        result = { erro: 'falha ao acessar a agenda, tente de novo ou peca para a recepcao entrar em contato' };
      }
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  throw new Error('O agente usou ferramentas demais sem responder');
}

async function sendMessage(clinic, content) {
  const messages = [{ role: 'user', content }];
  return chat(clinic, messages);
}

module.exports = {
  chat,
  sendMessage,
};
