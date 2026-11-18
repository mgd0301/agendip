const { Router } = require('express');
const { query, transaction } = require('../db');
const { pick, required, notFound, conflict, badRequest } = require('../utils/http');

const router = Router();
const CAMPOS = ['nombre', 'apellido', 'dni', 'fecha_nacimiento', 'sexo', 'telefono', 'email', 'direccion', 'obra_social_id', 'plan_id', 'nro_afiliado', 'observaciones'];

// Búsqueda paginada por nombre, apellido, DNI, teléfono o email.
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const where = ['p.organizacion_id = ?', 'p.activo = 1'];
  const params = [req.orgId];
  const q = String(req.query.q || '').trim();
  if (q) {
    for (const palabra of q.split(/\s+/).slice(0, 4)) {
      const like = `%${palabra}%`;
      where.push('(p.nombre LIKE ? OR p.apellido LIKE ? OR p.dni LIKE ? OR p.telefono LIKE ? OR p.email LIKE ?)');
      params.push(like, like, like, like, like);
    }
  }
  const sqlWhere = where.join(' AND ');
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM pacientes p WHERE ${sqlWhere}`, params);
  const items = await query(
    `SELECT p.id, p.nombre, p.apellido, p.dni, p.telefono, p.email, p.fecha_nacimiento,
            os.nombre AS obra_social, pl.nombre AS plan
       FROM pacientes p
       LEFT JOIN obras_sociales os ON os.id = p.obra_social_id
       LEFT JOIN obras_sociales_planes pl ON pl.id = p.plan_id
      WHERE ${sqlWhere} ORDER BY p.apellido, p.nombre LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );
  res.json({ items, total, page, limit });
});

router.get('/:id', async (req, res) => {
  const [p] = await query(
    `SELECT p.*, os.nombre AS obra_social, pl.nombre AS plan
       FROM pacientes p
       LEFT JOIN obras_sociales os ON os.id = p.obra_social_id
       LEFT JOIN obras_sociales_planes pl ON pl.id = p.plan_id
      WHERE p.id = ? AND p.organizacion_id = ?`,
    [req.params.id, req.orgId]
  );
  if (!p) throw notFound('Paciente no encontrado');
  const valores = await query('SELECT campo_id, valor FROM paciente_valores WHERE paciente_id = ?', [p.id]);
  p.campos = Object.fromEntries(valores.map((v) => [v.campo_id, v.valor]));
  res.json(p);
});

router.get('/:id/turnos', async (req, res) => {
  res.json(
    await query(
      `SELECT t.id, t.inicio, t.fin, t.duracion_min, t.estado, t.sobreturno, t.es_virtual, t.observaciones,
              pr.nombre AS prof_nombre, pr.apellido AS prof_apellido, ps.nombre AS prestacion
         FROM turnos t
         JOIN profesionales pr ON pr.id = t.profesional_id
         LEFT JOIN prestaciones ps ON ps.id = t.prestacion_id
        WHERE t.paciente_id = ? AND t.organizacion_id = ?
        ORDER BY t.inicio DESC`,
      [req.params.id, req.orgId]
    )
  );
});

async function verificarDni(orgId, dni, excluirId) {
  if (!dni) return;
  const [dup] = await query('SELECT id FROM pacientes WHERE organizacion_id = ? AND dni = ? AND id <> ?', [orgId, dni, excluirId || 0]);
  if (dup) throw conflict('Ya existe un paciente con ese DNI');
}

// La obra social y el plan deben ser de la organización, y el plan de esa obra social.
async function validarCobertura(orgId, datos) {
  if ('obra_social_id' in datos && !datos.obra_social_id) datos.plan_id = null;
  if (datos.obra_social_id) {
    const [os] = await query('SELECT id FROM obras_sociales WHERE id = ? AND organizacion_id = ?', [datos.obra_social_id, orgId]);
    if (!os) throw badRequest('Obra social inválida');
  }
  if (datos.plan_id) {
    const [pl] = await query(
      `SELECT pl.obra_social_id FROM obras_sociales_planes pl JOIN obras_sociales os ON os.id = pl.obra_social_id
        WHERE pl.id = ? AND os.organizacion_id = ?`,
      [datos.plan_id, orgId]
    );
    if (!pl || (datos.obra_social_id && pl.obra_social_id !== Number(datos.obra_social_id))) throw badRequest('El plan no corresponde a la obra social');
  }
}

async function guardarCampos(conn, orgId, pacienteId, campos) {
  if (!campos || typeof campos !== 'object') return;
  const validos = await query('SELECT id FROM campos_paciente WHERE organizacion_id = ?', [orgId], conn);
  const ids = new Set(validos.map((c) => c.id));
  for (const [campoId, valor] of Object.entries(campos)) {
    if (!ids.has(Number(campoId))) continue;
    await conn.query(
      'INSERT INTO paciente_valores (paciente_id, campo_id, valor) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)',
      [pacienteId, campoId, valor === '' ? null : valor]
    );
  }
}

router.post('/', async (req, res) => {
  required(req.body, ['nombre', 'apellido']);
  const datos = pick(req.body, CAMPOS);
  await verificarDni(req.orgId, datos.dni);
  await validarCobertura(req.orgId, datos);
  const id = await transaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO pacientes SET ?', [{ ...datos, organizacion_id: req.orgId }]);
    await guardarCampos(conn, req.orgId, r.insertId, req.body.campos);
    return r.insertId;
  });
  const [p] = await query('SELECT id, nombre, apellido, dni, telefono, email FROM pacientes WHERE id = ?', [id]);
  res.status(201).json(p);
});

router.put('/:id', async (req, res) => {
  const [p] = await query('SELECT id FROM pacientes WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!p) throw notFound('Paciente no encontrado');
  const datos = pick(req.body, CAMPOS);
  await verificarDni(req.orgId, datos.dni, p.id);
  await validarCobertura(req.orgId, datos);
  await transaction(async (conn) => {
    if (Object.keys(datos).length) await conn.query('UPDATE pacientes SET ? WHERE id = ?', [datos, p.id]);
    await guardarCampos(conn, req.orgId, p.id, req.body.campos);
  });
  res.json({ ok: true });
});

// Baja lógica para conservar el historial de turnos.
router.delete('/:id', async (req, res) => {
  const r = await query('UPDATE pacientes SET activo = 0 WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Paciente no encontrado');
  res.json({ ok: true });
});

module.exports = router;
