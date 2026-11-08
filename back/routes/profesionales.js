const { Router } = require('express');
const { query, transaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { pick, required, bool, notFound, badRequest, forbidden } = require('../utils/http');
const { esHora, aMinutos } = require('../utils/fechas');

const router = Router();
const CAMPOS = ['nombre', 'apellido', 'especialidad', 'matricula', 'email', 'telefono', 'color', 'duracion_turno_min'];

async function cargarDetalle(ids) {
  if (!ids.length) return { horarios: [], prestaciones: [] };
  const horarios = await query(
    `SELECT id, profesional_id, dia_semana, TIME_FORMAT(hora_desde, '%H:%i') AS hora_desde,
            TIME_FORMAT(hora_hasta, '%H:%i') AS hora_hasta
       FROM horarios WHERE profesional_id IN (?) ORDER BY dia_semana, hora_desde`,
    [ids]
  );
  const prestaciones = await query(
    'SELECT profesional_id, prestacion_id, duracion_min FROM profesional_prestacion WHERE profesional_id IN (?)',
    [ids]
  );
  return { horarios, prestaciones };
}

router.get('/', async (req, res) => {
  const soloActivos = req.query.todos !== '1';
  const rows = await query(
    `SELECT * FROM profesionales WHERE organizacion_id = ? ${soloActivos ? 'AND activo = 1' : ''}
      ORDER BY apellido, nombre`,
    [req.orgId]
  );
  const { horarios, prestaciones } = await cargarDetalle(rows.map((r) => r.id));
  for (const r of rows) {
    r.horarios = horarios.filter((h) => h.profesional_id === r.id);
    r.prestaciones = prestaciones.filter((p) => p.profesional_id === r.id);
  }
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [row] = await query('SELECT * FROM profesionales WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!row) throw notFound('Profesional no encontrado');
  const { horarios, prestaciones } = await cargarDetalle([row.id]);
  res.json({ ...row, horarios, prestaciones });
});

function validarHorarios(horarios) {
  if (!Array.isArray(horarios)) return [];
  const limpios = horarios.map((h) => {
    const dia = Number(h.dia_semana);
    if (!(dia >= 0 && dia <= 6)) throw badRequest('Día de semana inválido');
    if (!esHora(h.hora_desde) || !esHora(h.hora_hasta)) throw badRequest('Horario inválido');
    if (aMinutos(h.hora_desde) >= aMinutos(h.hora_hasta)) throw badRequest('La hora "desde" debe ser menor a la hora "hasta"');
    return { dia, desde: aMinutos(h.hora_desde), hasta: aMinutos(h.hora_hasta), h };
  });
  // Franjas del mismo día no pueden superponerse
  for (const a of limpios) {
    for (const b of limpios) {
      if (a !== b && a.dia === b.dia && a.desde < b.hasta && b.desde < a.hasta) {
        throw badRequest('Hay franjas horarias superpuestas en un mismo día');
      }
    }
  }
  return limpios.map((x) => x.h);
}

async function guardarDetalle(conn, profId, body) {
  if (body.horarios !== undefined) {
    const horarios = validarHorarios(body.horarios);
    await conn.query('DELETE FROM horarios WHERE profesional_id = ?', [profId]);
    if (horarios.length) {
      await conn.query('INSERT INTO horarios (profesional_id, dia_semana, hora_desde, hora_hasta) VALUES ?', [
        horarios.map((h) => [profId, h.dia_semana, h.hora_desde, h.hora_hasta]),
      ]);
    }
  }
  if (Array.isArray(body.prestaciones)) {
    await conn.query('DELETE FROM profesional_prestacion WHERE profesional_id = ?', [profId]);
    const filas = body.prestaciones.filter((p) => p.prestacion_id && p.duracion_min);
    if (filas.length) {
      await conn.query('INSERT INTO profesional_prestacion (profesional_id, prestacion_id, duracion_min) VALUES ?', [
        filas.map((p) => [profId, p.prestacion_id, p.duracion_min]),
      ]);
    }
  }
}

router.post('/', requireRole('admin'), async (req, res) => {
  required(req.body, ['nombre', 'apellido']);
  const [org] = await query(
    `SELECT o.max_profesionales, (SELECT COUNT(*) FROM profesionales p WHERE p.organizacion_id = o.id AND p.activo = 1) AS cantidad
       FROM organizaciones o WHERE o.id = ?`,
    [req.orgId]
  );
  if (org.max_profesionales && org.cantidad >= org.max_profesionales) {
    throw forbidden(`Su plan permite hasta ${org.max_profesionales} profesionales activos`);
  }
  const id = await transaction(async (conn) => {
    const [r] = await conn.query('INSERT INTO profesionales SET ?', [{ ...pick(req.body, CAMPOS), organizacion_id: req.orgId }]);
    await guardarDetalle(conn, r.insertId, req.body);
    return r.insertId;
  });
  res.status(201).json({ id });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const [row] = await query('SELECT id FROM profesionales WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!row) throw notFound('Profesional no encontrado');
  await transaction(async (conn) => {
    const datos = pick(req.body, CAMPOS);
    if (req.body.activo !== undefined) datos.activo = bool(req.body.activo);
    if (Object.keys(datos).length) await conn.query('UPDATE profesionales SET ? WHERE id = ?', [datos, row.id]);
    await guardarDetalle(conn, row.id, req.body);
  });
  res.json({ ok: true });
});

// Baja lógica: se conservan sus turnos e historial.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const r = await query('UPDATE profesionales SET activo = 0 WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Profesional no encontrado');
  res.json({ ok: true });
});

module.exports = router;
