const express = require('express');
const cors = require('cors');
require('dotenv').config();

const clinicService = require('./services/clinic.service');
const { requireSecret } = require('./middlewares/auth');
const agentRoutes = require('./routes/agent.routes');
const zapiRoutes = require('./routes/zapi.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API funcionando!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/clinics', requireSecret, (req, res) => {
  res.json(clinicService.listClinics());
});

// Precisa vir antes de /zapi/:clinicId, senao "webhook" seria lido como id do consultorio
app.post('/zapi/webhook', requireSecret, zapiRoutes.webhookByInstance);

app.use('/agent/:clinicId', agentRoutes);
app.use('/zapi/:clinicId', zapiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
