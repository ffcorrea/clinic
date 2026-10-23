// Protege rotas com o token definido em WEBHOOK_SECRET (?token=... ou header x-api-key)
function requireSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return next();

  const provided = req.query.token || req.headers['x-api-key'];
  if (provided !== secret) {
    return res.status(401).json({ error: 'nao autorizado' });
  }
  next();
}

module.exports = { requireSecret };
