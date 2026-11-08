const { Router } = require('express');
const { query } = require('../db');
const { assertProfesional } = require('../middleware/auth');
const { pick, required, notFound, badRequest, forbidden } = require('../utils/http');
const { esFecha, esHora, aMinutos } = require('../utils/fechas');

const router = Router();
const CAMPOS = ['profesional_id', 'tipo', 'fecha_desde', 'fecha_hasta', 'hora_desde', 'hora_hasta', 'motivo'];
const TIPOS = ['feriado', 'vacaciones', 'licencia', 'dia_libre', 'bloqueo', 'horario_especial'];

router.get('/', async (req, res) => {
  const where = ['e.organizacion_id = ?'];
  const params = [req.orgId];
  if (req.query.desde) {
    where.push('e.fecha_hasta >= ?');
    params.push(req.query.desde);
  }
  if (req.query.hasta) {
    where.push('e.fecha_desde <= ?');
    params.push(req.query.hasta);
  }
  if (req.query.profesional_id) {
    where.push('(e.profesional_id = ? OR e.profesional_id IS NULL)');
    params.push(req.query.profesional_id);
  }
  res.json(
    await query(
      `SELECT e.id, e.profesional_id, e.tipo, e.fecha_desde, e.fecha_hasta,
              TIME_FORMAT(e.hora_desde, '%H:%i') AS hora_desde, TIME_FORMAT(e.hora_hasta, '%H:%i') AS hora_hasta,
              e.motivo, p.nombre AS prof_nombre, p.apellido AS prof_apellido
         FROM excepciones e LEFT JOIN profesionales p ON p.id = e.profesional_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.fecha_desde DESC`,
      params
    )
  );
});

async function validar(req, datos) {
  if (!TIPOS.includes(datos.tipo)) throw badRequest('Tipo de excepción inválido');
  if (!esFecha(datos.fecha_desde) || !esFecha(datos.fecha_hasta)) throw badRequest('Fechas inválidas');
  if (datos.fecha_desde > datos.fecha_hasta) throw badRequest('La fecha "desde" debe ser anterior a la fecha "hasta"');
  const conHoras = datos.hora_desde || datos.hora_hasta;
  if (conHoras) {
    if (!esHora(datos.hora_desde) || !esHora(datos.hora_hasta)) throw badRequest('Indique ambas horas o ninguna');
    if (aMinutos(datos.hora_desde) >= aMinutos(datos.hora_hasta)) throw badRequest('La hora "desde" debe ser menor a la hora "hasta"');
  }
  if (datos.tipo === 'horario_especial') {
    if (!conHoras) throw badRequest('El horario especial requiere hora desde y hasta');
    if (!datos.profesional_id) throw badRequest('El horario especial debe indicar un profesional');
  }
  if (datos.profesional_id) {
    const [p] = await query('SELECT id FROM profesionales WHERE id = ? AND organizacion_id = ?', [datos.profesional_id, req.orgId]);
    if (!p) throw badRequest('Profesional inválido');
    assertProfesional(req.user, datos.profesional_id);
  } else if (req.user.rol === 'profesional') {
    throw forbidden('Solo puede cargar excepciones de su propia agenda');
  }
}

router.post('/', async (req, res) => {
  required(req.body, ['tipo', 'fecha_desde']);
  const datos = pick(req.body, CAMPOS);
  datos.fecha_hasta = datos.fecha_hasta || datos.fecha_desde;
  await validar(req, datos);
  const r = await query('INSERT INTO excepciones SET ?', [{ ...datos, organizacion_id: req.orgId, creado_por: req.user.id }]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', async (req, res) => {
  const [e] = await query('SELECT * FROM excepciones WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!e) throw notFound('Excepción no encontrada');
  if (req.user.rol === 'profesional') assertProfesional(req.user, e.profesional_id);
  const datos = { ...e, ...pick(req.body, CAMPOS) };
  datos.fecha_hasta = datos.fecha_hasta || datos.fecha_desde;
  await validar(req, datos);
  await query('UPDATE excepciones SET ? WHERE id = ?', [pick(datos, CAMPOS), e.id]);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const [e] = await query('SELECT * FROM excepciones WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!e) throw notFound('Excepción no encontrada');
  if (req.user.rol === 'profesional') assertProfesional(req.user, e.profesional_id);
  await query('DELETE FROM excepciones WHERE id = ?', [e.id]);
  res.json({ ok: true });
});

module.exports = router;
