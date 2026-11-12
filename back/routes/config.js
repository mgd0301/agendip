const { Router } = require('express');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { pick, required, bool, notFound, badRequest } = require('../utils/http');

const router = Router();
const soloAdmin = requireRole('admin');

// ----- Organización -----
router.get('/organizacion', async (req, res) => {
  const [o] = await query('SELECT * FROM organizaciones WHERE id = ?', [req.orgId]);
  res.json(o);
});

router.put('/organizacion', soloAdmin, async (req, res) => {
  const datos = pick(req.body, ['nombre', 'tipo', 'email', 'telefono', 'direccion', 'whatsapp_codigo_pais']);
  if (datos.nombre === null) throw badRequest('El nombre es obligatorio');
  if (req.body.hc_compartida !== undefined) datos.hc_compartida = bool(req.body.hc_compartida);
  if (Object.keys(datos).length) await query('UPDATE organizaciones SET ? WHERE id = ?', [datos, req.orgId]);
  res.json({ ok: true });
});

// ----- Estados de turno (colores / etiquetas) -----
router.get('/estados', async (req, res) => {
  res.json(await query('SELECT estado, etiqueta, color FROM estados_config WHERE organizacion_id = ?', [req.orgId]));
});

router.put('/estados', soloAdmin, async (req, res) => {
  if (!Array.isArray(req.body)) throw badRequest('Formato inválido');
  await transaction(async (conn) => {
    for (const e of req.body) {
      await conn.query(
        `INSERT INTO estados_config (organizacion_id, estado, etiqueta, color) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE etiqueta = VALUES(etiqueta), color = VALUES(color)`,
        [req.orgId, e.estado, e.etiqueta, e.color]
      );
    }
  });
  res.json({ ok: true });
});

// ----- Plantillas de mensajes -----
router.get('/plantillas', async (req, res) => {
  res.json(await query('SELECT * FROM plantillas_mensaje WHERE organizacion_id = ? ORDER BY canal, tipo', [req.orgId]));
});

router.put('/plantillas/:id', soloAdmin, async (req, res) => {
  required(req.body, ['cuerpo']);
  const datos = pick(req.body, ['asunto', 'cuerpo']);
  if (req.body.activo !== undefined) datos.activo = bool(req.body.activo);
  const r = await query('UPDATE plantillas_mensaje SET ? WHERE id = ? AND organizacion_id = ?', [datos, req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Plantilla no encontrada');
  res.json({ ok: true });
});

// ----- Campos adicionales de pacientes -----
router.get('/campos-paciente', async (req, res) => {
  res.json(await query('SELECT * FROM campos_paciente WHERE organizacion_id = ? AND activo = 1 ORDER BY orden, id', [req.orgId]));
});

const CAMPOS_CP = ['nombre', 'tipo', 'opciones', 'orden'];

router.post('/campos-paciente', soloAdmin, async (req, res) => {
  required(req.body, ['nombre']);
  const r = await query('INSERT INTO campos_paciente SET ?', [{ ...pick(req.body, CAMPOS_CP), organizacion_id: req.orgId }]);
  res.status(201).json({ id: r.insertId });
});

router.put('/campos-paciente/:id', soloAdmin, async (req, res) => {
  const r = await query('UPDATE campos_paciente SET ? WHERE id = ? AND organizacion_id = ?', [pick(req.body, CAMPOS_CP), req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Campo no encontrado');
  res.json({ ok: true });
});

router.delete('/campos-paciente/:id', soloAdmin, async (req, res) => {
  const r = await query('UPDATE campos_paciente SET activo = 0 WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Campo no encontrado');
  res.json({ ok: true });
});

module.exports = router;
