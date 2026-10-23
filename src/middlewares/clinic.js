const clinicService = require('../services/clinic.service');

// Carrega o consultorio de /:clinicId em req.clinic
function loadClinic(req, res, next) {
  const clinic = clinicService.getClinic(req.params.clinicId);
  if (!clinic) {
    return res.status(404).json({ error: `consultorio "${req.params.clinicId}" nao encontrado` });
  }
  req.clinic = clinic;
  next();
}

module.exports = { loadClinic };
