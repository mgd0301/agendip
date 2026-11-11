const { Router } = require('express');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { required, notFound, conflict } = require('../utils/http');

const router = Router();
const editor = requireRole('admin', 'recepcion');

const nombreDe = (body) => String(body.nombre).trim();

// Traduce el error de nombre repetido (índice único) a un mensaje claro.
async function sinDuplicado(fn, msg) {
  try {
    return await fn();
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw conflict(msg);
    throw err;
  }
}

async function obraSocialDeOrg(id, orgId) {
  const [os] = await query('SELECT id FROM obras_sociales WHERE id = ? AND organizacion_id = ?', [id, orgId]);
  if (!os) throw notFound('Obra social no encontrada');
  return os;
}

async function planDeOrg(id, orgId) {
  const [p] = await query(
    `SELECT pl.id FROM obras_sociales_planes pl JOIN obras_sociales os ON os.id = pl.obra_social_id
      WHERE pl.id = ? AND os.organizacion_id = ?`,
    [id, orgId]
  );
  if (!p) throw notFound('Plan no encontrado');
  return p;
}

// Obras sociales activas, cada una con sus planes activos.
router.get('/', async (req, res) => {
  const lista = await query('SELECT id, nombre FROM obras_sociales WHERE organizacion_id = ? AND activo = 1 ORDER BY nombre', [req.orgId]);
  const planes = await query(
    `SELECT pl.id, pl.obra_social_id, pl.nombre FROM obras_sociales_planes pl
       JOIN obras_sociales os ON os.id = pl.obra_social_id
      WHERE os.organizacion_id = ? AND pl.activo = 1 ORDER BY pl.nombre`,
    [req.orgId]
  );
  for (const os of lista) os.planes = planes.filter((p) => p.obra_social_id === os.id);
  res.json(lista);
});

// Si existía dada de baja con el mismo nombre, se reactiva.
router.post('/', editor, async (req, res) => {
  required(req.body, ['nombre']);
  const r = await query(
    `INSERT INTO obras_sociales (organizacion_id, nombre) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE activo = 1, id = LAST_INSERT_ID(id)`,
    [req.orgId, nombreDe(req.body)]
  );
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', editor, async (req, res) => {
  required(req.body, ['nombre']);
  await obraSocialDeOrg(req.params.id, req.orgId);
  await sinDuplicado(
    () => query('UPDATE obras_sociales SET nombre = ? WHERE id = ?', [nombreDe(req.body), req.params.id]),
    'Ya existe una obra social con ese nombre'
  );
  res.json({ ok: true });
});

// Baja lógica: los pacientes que la tienen la conservan.
router.delete('/:id', editor, async (req, res) => {
  await obraSocialDeOrg(req.params.id, req.orgId);
  await query('UPDATE obras_sociales SET activo = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ----- Planes -----
router.post('/:id/planes', editor, async (req, res) => {
  required(req.body, ['nombre']);
  await obraSocialDeOrg(req.params.id, req.orgId);
  const r = await query(
    `INSERT INTO obras_sociales_planes (obra_social_id, nombre) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE activo = 1, id = LAST_INSERT_ID(id)`,
    [req.params.id, nombreDe(req.body)]
  );
  res.status(201).json({ id: r.insertId });
});

router.put('/planes/:planId', editor, async (req, res) => {
  required(req.body, ['nombre']);
  await planDeOrg(req.params.planId, req.orgId);
  await sinDuplicado(
    () => query('UPDATE obras_sociales_planes SET nombre = ? WHERE id = ?', [nombreDe(req.body), req.params.planId]),
    'Esa obra social ya tiene un plan con ese nombre'
  );
  res.json({ ok: true });
});

router.delete('/planes/:planId', editor, async (req, res) => {
  await planDeOrg(req.params.planId, req.orgId);
  await query('UPDATE obras_sociales_planes SET activo = 0 WHERE id = ?', [req.params.planId]);
  res.json({ ok: true });
});

module.exports = router;
