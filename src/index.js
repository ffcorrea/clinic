const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

app.use('/agent', agentRoutes);
app.use('/zapi', zapiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
