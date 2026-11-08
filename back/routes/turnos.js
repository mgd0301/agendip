const { Router } = require('express');
const { query, transaction } = require('../db');
const { assertProfesional, puedeSobreturno } = require('../middleware/auth');
const { pick, required, notFound, badRequest, bool } = require('../utils/http');
const { esFecha, esHora, rangoFechas, ahora, formatoFecha, DIAS, diaSemana } = require('../utils/fechas');
const { cargarContexto, franjasDelDia, validarTurno, horariosLibres } = require('../services/agenda');
const { generarMensaje, telefonoWhatsapp } = require('../services/mensajes');

const router = Router();
const ESTADOS = ['pendiente', 'confirmado', 'atendido', 'ausente', 'cancelado'];

const SELECT_TURNO = `
  SELECT t.id, t.profesional_id, t.paciente_id, t.prestacion_id, t.inicio, t.fin, t.duracion_min,
         t.estado, t.sobreturno, t.observaciones, t.motivo_cancelacion, t.creado_en, t.actualizado_en,
         pa.nombre AS pac_nombre, pa.apellido AS pac_apellido, pa.telefono AS pac_telefono,
         pa.email AS pac_email, pa.dni AS pac_dni,
         pr.nombre AS prof_nombre, pr.apellido AS prof_apellido, pr.color AS prof_color,
         ps.nombre AS prestacion, ps.color AS prest_color,
         uc.nombre AS creado_por_nombre, ua.nombre AS actualizado_por_nombre
    FROM turnos t
    JOIN pacientes pa ON pa.id = t.paciente_id
    JOIN profesionales pr ON pr.id = t.profesional_id
    LEFT JOIN prestaciones ps ON ps.id = t.prestacion_id
    LEFT JOIN usuarios uc ON uc.id = t.creado_por
    LEFT JOIN usuarios ua ON ua.id = t.actualizado_por`;

const idsProfesionales = (txt) =>
  String(txt || '')
    .split(',')
    .map(Number)
    .filter((n) => n > 0);

// Vista de agenda: turnos + franjas de atención/bloqueos de cada profesional por día.
router.get('/agenda', async (req, res) => {
  const { desde, hasta } = req.query;
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) throw badRequest('Rango de fechas inválido');
  const dias = rangoFechas(desde, hasta);
  if (dias.length > 62) throw badRequest('El rango máximo es de 62 días');

  let ids = idsProfesionales(req.query.profesionales);
  if (req.user.rol === 'profesional') ids = [req.user.profesional_id].filter(Boolean);
  const profesionales = ids.length
    ? await query('SELECT id FROM profesionales WHERE organizacion_id = ? AND id IN (?)', [req.orgId, ids])
    : [];
  ids = profesionales.map((p) => p.id);
  if (!ids.length) return res.json({ turnos: [], disponibilidad: {} });

  const turnos = await query(
    `${SELECT_TURNO}
      WHERE t.organizacion_id = ? AND t.profesional_id IN (?) AND t.inicio >= ? AND t.inicio <= ?
        ${req.query.cancelados === '1' ? '' : "AND t.estado <> 'cancelado'"}
      ORDER BY t.inicio`,
    [req.orgId, ids, `${desde} 00:00:00`, `${hasta} 23:59:59`]
  );

  const ctx = await cargarContexto(req.orgId, ids, desde, hasta);
  const disponibilidad = {};
  for (const id of ids) {
    disponibilidad[id] = {};
    for (const fecha of dias) {
      const { franjas, bloqueos, horario_especial } = franjasDelDia(ctx, id, fecha);
      disponibilidad[id][fecha] = { franjas, bloqueos, horario_especial };
    }
  }
  res.json({ turnos, disponibilidad });
});

// Horarios libres para un profesional/fecha/duración.
router.get('/disponibilidad', async (req, res) => {
  const { profesional_id, fecha, duracion, excluir } = req.query;
  if (!esFecha(fecha)) throw badRequest('Fecha inválida');
  const [prof] = await query('SELECT * FROM profesionales WHERE id = ? AND organizacion_id = ?', [profesional_id, req.orgId]);
  if (!prof) throw notFound('Profesional no encontrado');
  res.json(await horariosLibres(req.orgId, prof, fecha, duracion, excluir));
});

// Resumen de la agenda de un profesional en texto, para enviárselo por WhatsApp.
router.get('/resumen-agenda', async (req, res) => {
  const { desde, hasta } = req.query;
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) throw badRequest('Rango de fechas inválido');
  const dias = rangoFechas(desde, hasta);
  if (dias.length > 31) throw badRequest('El rango máximo es de 31 días');
  const profId = req.user.rol === 'profesional' ? req.user.profesional_id : req.query.profesional_id;
  const [prof] = await query(
    `SELECT pr.nombre, pr.apellido, pr.telefono, o.whatsapp_codigo_pais
       FROM profesionales pr JOIN organizaciones o ON o.id = pr.organizacion_id
      WHERE pr.id = ? AND pr.organizacion_id = ?`,
    [profId || 0, req.orgId]
  );
  if (!prof) throw notFound('Profesional no encontrado');

  const turnos = await query(
    `SELECT t.inicio, t.sobreturno, pa.nombre AS pac_nombre, pa.apellido AS pac_apellido, ps.nombre AS prestacion
       FROM turnos t
       JOIN pacientes pa ON pa.id = t.paciente_id
       LEFT JOIN prestaciones ps ON ps.id = t.prestacion_id
      WHERE t.organizacion_id = ? AND t.profesional_id = ? AND t.estado <> 'cancelado' AND t.inicio >= ? AND t.inicio <= ?
      ORDER BY t.inicio`,
    [req.orgId, profId, `${desde} 00:00:00`, `${hasta} 23:59:59`]
  );

  const nombreDia = (f) => `${DIAS[diaSemana(f)]} ${formatoFecha(f).slice(0, 5)}`;
  const linea = (t) =>
    `${t.inicio.slice(11, 16)} ${t.pac_apellido}, ${t.pac_nombre}${t.prestacion ? ` · ${t.prestacion}` : ''}${Number(t.sobreturno) ? ' (sobreturno)' : ''}`;
  const titulo = desde === hasta ? nombreDia(desde) : `${formatoFecha(desde)} al ${formatoFecha(hasta)}`;
  const nombreProf = `${prof.nombre} ${prof.apellido}`.replace(/\s+/g, ' ').trim();
  const partes = [`*Agenda de ${nombreProf}* – ${titulo}`, ''];
  if (!turnos.length) partes.push('Sin turnos.');
  else if (desde === hasta) partes.push(...turnos.map(linea));
  else {
    for (const f of dias) {
      const delDia = turnos.filter((t) => t.inicio.startsWith(f));
      if (!delDia.length) continue;
      partes.push(`*${nombreDia(f).replace(/^./, (c) => c.toUpperCase())}*`, ...delDia.map(linea), '');
    }
    if (partes[partes.length - 1] === '') partes.pop();
  }
  if (turnos.length) partes.push('', `Total: ${turnos.length} turno${turnos.length > 1 ? 's' : ''}`);
  const texto = partes.join('\n');

  const tel = telefonoWhatsapp(prof.telefono, prof.whatsapp_codigo_pais || '549');
  res.json({
    texto,
    cantidad: turnos.length,
    telefono: tel,
    link: `https://wa.me/${tel || ''}?text=${encodeURIComponent(texto)}`,
  });
});

// Búsqueda global de turnos.
router.get('/', async (req, res) => {
  const where = ['t.organizacion_id = ?'];
  const params = [req.orgId];
  if (req.user.rol === 'profesional') {
    where.push('t.profesional_id = ?');
    params.push(req.user.profesional_id || 0);
  } else if (req.query.profesional_id) {
    where.push('t.profesional_id = ?');
    params.push(req.query.profesional_id);
  }
  if (req.query.estado && ESTADOS.includes(req.query.estado)) {
    where.push('t.estado = ?');
    params.push(req.query.estado);
  }
  if (esFecha(req.query.desde)) {
    where.push('t.inicio >= ?');
    params.push(`${req.query.desde} 00:00:00`);
  }
  if (esFecha(req.query.hasta)) {
    where.push('t.inicio <= ?');
    params.push(`${req.query.hasta} 23:59:59`);
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    for (const palabra of q.split(/\s+/).slice(0, 4)) {
      const like = `%${palabra}%`;
      where.push('(pa.nombre LIKE ? OR pa.apellido LIKE ? OR pa.dni LIKE ? OR pa.telefono LIKE ?)');
      params.push(like, like, like, like);
    }
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const orden = req.query.orden === 'asc' ? 'ASC' : 'DESC';
  const sqlWhere = where.join(' AND ');
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM turnos t JOIN pacientes pa ON pa.id = t.paciente_id WHERE ${sqlWhere}`,
    params
  );
  const items = await query(`${SELECT_TURNO} WHERE ${sqlWhere} ORDER BY t.inicio ${orden} LIMIT ? OFFSET ?`, [
    ...params,
    limit,
    (page - 1) * limit,
  ]);
  res.json({ items, total, page, limit });
});

async function obtener(orgId, id, conn) {
  const [t] = await query(`${SELECT_TURNO} WHERE t.id = ? AND t.organizacion_id = ?`, [id, orgId], conn);
  if (!t) throw notFound('Turno no encontrado');
  return t;
}

router.get('/:id', async (req, res) => {
  const t = await obtener(req.orgId, req.params.id);
  assertProfesional(req.user, t.profesional_id);
  t.historial = await query(
    `SELECT h.id, h.accion, h.detalle, h.fecha, u.nombre AS usuario
       FROM turno_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id
      WHERE h.turno_id = ? ORDER BY h.fecha DESC, h.id DESC`,
    [t.id]
  );
  res.json(t);
});

const registrar = (conn, turnoId, usuarioId, accion, detalle, anteriores) =>
  conn.query('INSERT INTO turno_historial (turno_id, usuario_id, accion, detalle, datos_anteriores) VALUES (?, ?, ?, ?, ?)', [
    turnoId,
    usuarioId,
    accion,
    detalle ? String(detalle).slice(0, 500) : null,
    anteriores ? JSON.stringify(anteriores) : null,
  ]);

const normalizarInicio = (fecha, hora) => `${fecha} ${hora.slice(0, 5)}:00`;
const legible = (dt) => `${formatoFecha(dt)} ${dt.slice(11, 16)}`;

// Duración: la indicada, o la de la prestación para ese profesional, o la de la prestación, o la del profesional.
async function resolverDuracion(conn, body, prof) {
  if (Number(body.duracion_min) > 0) return Number(body.duracion_min);
  if (body.prestacion_id) {
    const [pp] = await query(
      `SELECT COALESCE(pp.duracion_min, ps.duracion_min) AS dur
         FROM prestaciones ps LEFT JOIN profesional_prestacion pp ON pp.prestacion_id = ps.id AND pp.profesional_id = ?
        WHERE ps.id = ?`,
      [prof.id, body.prestacion_id],
      conn
    );
    if (pp && pp.dur) return Number(pp.dur);
  }
  return Number(prof.duracion_turno_min) || 30;
}

async function validarReferencias(conn, orgId, body) {
  const [prof] = await query(
    'SELECT * FROM profesionales WHERE id = ? AND organizacion_id = ? AND activo = 1 FOR UPDATE',
    [body.profesional_id, orgId],
    conn
  );
  if (!prof) throw badRequest('Profesional inválido');
  const [pac] = await query('SELECT id FROM pacientes WHERE id = ? AND organizacion_id = ?', [body.paciente_id, orgId], conn);
  if (!pac) throw badRequest('Paciente inválido');
  if (body.prestacion_id) {
    const [ps] = await query('SELECT id FROM prestaciones WHERE id = ? AND organizacion_id = ?', [body.prestacion_id, orgId], conn);
    if (!ps) throw badRequest('Prestación inválida');
  }
  return prof;
}

router.post('/', async (req, res) => {
  required(req.body, ['profesional_id', 'paciente_id', 'fecha', 'hora']);
  const { fecha, hora } = req.body;
  if (!esFecha(fecha) || !esHora(hora)) throw badRequest('Fecha u hora inválida');
  assertProfesional(req.user, req.body.profesional_id);

  const id = await transaction(async (conn) => {
    // El FOR UPDATE sobre el profesional serializa altas concurrentes en su agenda.
    const prof = await validarReferencias(conn, req.orgId, req.body);
    const duracion = await resolverDuracion(conn, req.body, prof);
    const inicio = normalizarInicio(fecha, hora);
    const { fin, esSobreturno } = await validarTurno(
      {
        orgId: req.orgId,
        profesionalId: prof.id,
        inicio,
        duracion,
        sobreturno: bool(req.body.sobreturno),
        permiteSobreturno: puedeSobreturno(req.user),
      },
      conn
    );
    const [r] = await conn.query('INSERT INTO turnos SET ?', [
      {
        organizacion_id: req.orgId,
        profesional_id: prof.id,
        paciente_id: req.body.paciente_id,
        prestacion_id: req.body.prestacion_id || null,
        inicio,
        fin,
        duracion_min: duracion,
        estado: ESTADOS.includes(req.body.estado) && req.body.estado !== 'cancelado' ? req.body.estado : 'pendiente',
        sobreturno: esSobreturno ? 1 : 0,
        observaciones: req.body.observaciones || null,
        creado_por: req.user.id,
      },
    ]);
    await registrar(conn, r.insertId, req.user.id, 'creado', `Turno ${legible(inicio)} (${duracion} min)${esSobreturno ? ' - sobreturno' : ''}`);
    return r.insertId;
  });
  res.status(201).json(await obtener(req.orgId, id));
});

// Edición / reprogramación.
router.put('/:id', async (req, res) => {
  const turno = await transaction(async (conn) => {
    const [actual] = await query('SELECT * FROM turnos WHERE id = ? AND organizacion_id = ? FOR UPDATE', [req.params.id, req.orgId], conn);
    if (!actual) throw notFound('Turno no encontrado');
    assertProfesional(req.user, actual.profesional_id);
    if (actual.estado === 'cancelado') throw badRequest('No se puede modificar un turno cancelado');

    const nuevo = {
      profesional_id: req.body.profesional_id || actual.profesional_id,
      paciente_id: req.body.paciente_id || actual.paciente_id,
      prestacion_id: req.body.prestacion_id !== undefined ? req.body.prestacion_id || null : actual.prestacion_id,
      fecha: req.body.fecha || actual.inicio.slice(0, 10),
      hora: req.body.hora || actual.inicio.slice(11, 16),
      duracion_min: req.body.duracion_min || actual.duracion_min,
    };
    if (!esFecha(nuevo.fecha) || !esHora(nuevo.hora)) throw badRequest('Fecha u hora inválida');
    assertProfesional(req.user, nuevo.profesional_id);
    const prof = await validarReferencias(conn, req.orgId, nuevo);
    const inicio = normalizarInicio(nuevo.fecha, nuevo.hora);
    const duracion = Number(nuevo.duracion_min);

    const cambiaHorario =
      inicio !== actual.inicio || duracion !== Number(actual.duracion_min) || Number(prof.id) !== Number(actual.profesional_id);
    let fin = actual.fin;
    let esSobreturno = Number(actual.sobreturno) === 1;
    if (cambiaHorario) {
      ({ fin, esSobreturno } = await validarTurno(
        {
          orgId: req.orgId,
          profesionalId: prof.id,
          inicio,
          duracion,
          excluirId: actual.id,
          sobreturno: bool(req.body.sobreturno),
          permiteSobreturno: puedeSobreturno(req.user),
        },
        conn
      ));
    }

    const datos = {
      profesional_id: prof.id,
      paciente_id: nuevo.paciente_id,
      prestacion_id: nuevo.prestacion_id,
      inicio,
      fin,
      duracion_min: duracion,
      sobreturno: esSobreturno ? 1 : 0,
      actualizado_por: req.user.id,
      actualizado_en: ahora(),
    };
    if (req.body.observaciones !== undefined) datos.observaciones = req.body.observaciones || null;
    await conn.query('UPDATE turnos SET ? WHERE id = ?', [datos, actual.id]);

    const reprogramado = inicio !== actual.inicio || Number(prof.id) !== Number(actual.profesional_id);
    const detalle = reprogramado
      ? `De ${legible(actual.inicio)} a ${legible(inicio)}${Number(prof.id) !== Number(actual.profesional_id) ? ' (cambio de profesional)' : ''}`
      : 'Datos del turno modificados';
    await registrar(conn, actual.id, req.user.id, reprogramado ? 'reprogramado' : 'modificado', detalle, actual);
    return actual.id;
  });
  res.json(await obtener(req.orgId, turno));
});

// Cambio de estado (incluye cancelación con motivo).
router.patch('/:id/estado', async (req, res) => {
  const { estado, motivo } = req.body;
  if (!ESTADOS.includes(estado)) throw badRequest('Estado inválido');
  await transaction(async (conn) => {
    const [actual] = await query('SELECT * FROM turnos WHERE id = ? AND organizacion_id = ? FOR UPDATE', [req.params.id, req.orgId], conn);
    if (!actual) throw notFound('Turno no encontrado');
    assertProfesional(req.user, actual.profesional_id);
    if (actual.estado === estado) return;

    if (actual.estado === 'cancelado') {
      // Reactivar un turno cancelado exige que el horario siga libre.
      await validarTurno(
        {
          orgId: req.orgId,
          profesionalId: actual.profesional_id,
          inicio: actual.inicio,
          duracion: actual.duracion_min,
          excluirId: actual.id,
          sobreturno: bool(req.body.sobreturno),
          permiteSobreturno: puedeSobreturno(req.user),
        },
        conn
      );
    }
    await conn.query('UPDATE turnos SET estado = ?, motivo_cancelacion = ?, actualizado_por = ?, actualizado_en = ? WHERE id = ?', [
      estado,
      estado === 'cancelado' ? motivo || null : null,
      req.user.id,
      ahora(),
      actual.id,
    ]);
    await registrar(
      conn,
      actual.id,
      req.user.id,
      estado === 'cancelado' ? 'cancelado' : 'estado',
      `${actual.estado} → ${estado}${estado === 'cancelado' && motivo ? `. Motivo: ${motivo}` : ''}`,
      { estado: actual.estado }
    );
  });
  res.json(await obtener(req.orgId, req.params.id));
});

// Genera el mensaje de WhatsApp (envío manual con link wa.me) y lo registra.
router.post('/:id/whatsapp', async (req, res) => {
  const tipo = ['confirmacion', 'recordatorio', 'cancelacion', 'reprogramacion'].includes(req.body.tipo) ? req.body.tipo : 'confirmacion';
  const m = await generarMensaje(req.orgId, req.params.id, tipo, 'whatsapp');
  assertProfesional(req.user, m.turno.profesional_id);
  if (!m.link) throw badRequest('El paciente no tiene un teléfono cargado');
  await transaction(async (conn) => {
    await conn.query(
      `INSERT INTO notificaciones (organizacion_id, turno_id, canal, tipo, destinatario, mensaje, estado, enviado_en, usuario_id)
       VALUES (?, ?, 'whatsapp', ?, ?, ?, 'manual', ?, ?)`,
      [req.orgId, m.turno.id, tipo, m.destinatario, m.texto, ahora(), req.user.id]
    );
    await registrar(conn, m.turno.id, req.user.id, 'mensaje', `WhatsApp (${tipo}) a ${m.destinatario}`);
  });
  res.json({ link: m.link, texto: m.texto });
});

module.exports = router;
module.exports.ESTADOS = ESTADOS;
