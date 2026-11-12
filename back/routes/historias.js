const { Router } = require('express');
const { query } = require('../db');
const { forbidden, notFound, badRequest, required } = require('../utils/http');
const { esFecha, esHora } = require('../utils/fechas');

// Historia clínica (Ley 26.529). Solo acceden usuarios vinculados a un profesional:
// recepción y administradores que no atienden no la ven.
// Lo registrado no se borra: una evolución se corrige solo el mismo día; después se aclara.
const router = Router();

router.use((req, res, next) => {
  if (!req.user.profesional_id) return next(forbidden('La historia clínica solo la ven los profesionales'));
  next();
});

const CAMPOS_EVO = ['motivo', 'examen', 'diagnostico', 'indicaciones'];
const texto = (v) => (v === undefined || v === null ? null : String(v).trim() || null);

async function compartida(orgId) {
  const [o] = await query('SELECT hc_compartida FROM organizaciones WHERE id = ?', [orgId]);
  return Number(o?.hc_compartida) === 1;
}

// Filtro de visibilidad: compartida = todo el consultorio; si no, solo lo del profesional.
async function filtro(req, alias) {
  return (await compartida(req.orgId)) ? { sql: '', params: [] } : { sql: ` AND ${alias}.profesional_id = ?`, params: [req.user.profesional_id] };
}

async function paciente(req, id) {
  const [p] = await query(
    `SELECT p.id, p.nombre, p.apellido, p.dni, p.fecha_nacimiento, p.sexo, p.telefono, p.nro_afiliado,
            os.nombre AS obra_social, pl.nombre AS plan
       FROM pacientes p
       LEFT JOIN obras_sociales os ON os.id = p.obra_social_id
       LEFT JOIN obras_sociales_planes pl ON pl.id = p.plan_id
      WHERE p.id = ? AND p.organizacion_id = ?`,
    [id, req.orgId]
  );
  if (!p) throw notFound('Paciente no encontrado');
  return p;
}

// Evolución visible para el usuario, o 404.
async function evolucion(req, id) {
  const f = await filtro(req, 'e');
  const [e] = await query(`SELECT e.* FROM hc_evoluciones e WHERE e.id = ? AND e.organizacion_id = ?${f.sql}`, [id, req.orgId, ...f.params]);
  if (!e) throw notFound('Evolución no encontrada');
  return e;
}

router.get('/:pacienteId', async (req, res) => {
  const p = await paciente(req, req.params.pacienteId);
  const comp = await compartida(req.orgId);
  const f = await filtro(req, 'x');
  const quien = `pr.nombre AS prof_nombre, pr.apellido AS prof_apellido, pr.especialidad AS prof_especialidad, pr.matricula AS prof_matricula`;

  const [antecedentes] = await query(
    `SELECT x.antecedentes, x.alergias, x.medicacion, x.creado_en, ${quien}
       FROM hc_antecedentes x JOIN profesionales pr ON pr.id = x.profesional_id
      WHERE x.paciente_id = ? AND x.organizacion_id = ?${f.sql}
      ORDER BY x.id DESC LIMIT 1`,
    [p.id, req.orgId, ...f.params]
  );

  const evoluciones = await query(
    `SELECT x.id, x.profesional_id, x.turno_id, x.fecha, x.motivo, x.examen, x.diagnostico, x.indicaciones,
            x.creado_en, x.editado_en, DATE(x.creado_en) = CURDATE() AS del_dia, ${quien}
       FROM hc_evoluciones x JOIN profesionales pr ON pr.id = x.profesional_id
      WHERE x.paciente_id = ? AND x.organizacion_id = ?${f.sql}
      ORDER BY x.fecha DESC, x.id DESC`,
    [p.id, req.orgId, ...f.params]
  );

  const ids = evoluciones.map((e) => e.id);
  const aclaraciones = ids.length
    ? await query(
        `SELECT a.id, a.evolucion_id, a.texto, a.creado_en, pr.nombre AS prof_nombre, pr.apellido AS prof_apellido
           FROM hc_aclaraciones a JOIN profesionales pr ON pr.id = a.profesional_id
          WHERE a.evolucion_id IN (?) ORDER BY a.id`,
        [ids]
      )
    : [];

  const mio = Number(req.user.profesional_id);
  res.json({
    paciente: p,
    compartida: comp,
    antecedentes: antecedentes || null,
    evoluciones: evoluciones.map(({ del_dia, ...e }) => ({
      ...e,
      // El autor la puede corregir solo el mismo día en que la cargó.
      editable: Number(e.profesional_id) === mio && Number(del_dia) === 1,
      aclaraciones: aclaraciones.filter((a) => a.evolucion_id === e.id),
    })),
  });
});

router.put('/:pacienteId/antecedentes', async (req, res) => {
  const p = await paciente(req, req.params.pacienteId);
  // No se pisa la versión anterior: se agrega una nueva.
  await query('INSERT INTO hc_antecedentes SET ?', [
    {
      organizacion_id: req.orgId,
      paciente_id: p.id,
      profesional_id: req.user.profesional_id,
      usuario_id: req.user.id,
      antecedentes: texto(req.body.antecedentes),
      alergias: texto(req.body.alergias),
      medicacion: texto(req.body.medicacion),
    },
  ]);
  res.json({ ok: true });
});

function datosEvolucion(body) {
  const datos = Object.fromEntries(CAMPOS_EVO.map((c) => [c, texto(body[c])]));
  if (!CAMPOS_EVO.some((c) => datos[c])) throw badRequest('Complete al menos un campo de la evolución');
  if (body.fecha !== undefined) {
    const [f, h] = String(body.fecha).split(/[ T]/);
    if (!esFecha(f) || !esHora(h || '')) throw badRequest('Fecha inválida');
    datos.fecha = `${f} ${h.slice(0, 5)}:00`;
  }
  return datos;
}

router.post('/:pacienteId/evoluciones', async (req, res) => {
  const p = await paciente(req, req.params.pacienteId);
  const datos = datosEvolucion(req.body);
  let turnoId = null;
  if (req.body.turno_id) {
    const [tu] = await query('SELECT id, inicio FROM turnos WHERE id = ? AND paciente_id = ? AND organizacion_id = ?', [
      req.body.turno_id,
      p.id,
      req.orgId,
    ]);
    if (!tu) throw badRequest('Turno inválido');
    turnoId = tu.id;
    if (!datos.fecha) datos.fecha = tu.inicio;
  }
  const r = await query(`INSERT INTO hc_evoluciones SET ?, fecha = ${datos.fecha ? '?' : 'NOW()'}`, [
    {
      organizacion_id: req.orgId,
      paciente_id: p.id,
      profesional_id: req.user.profesional_id,
      usuario_id: req.user.id,
      turno_id: turnoId,
      ...Object.fromEntries(CAMPOS_EVO.map((c) => [c, datos[c]])),
    },
    ...(datos.fecha ? [datos.fecha] : []),
  ]);
  res.status(201).json({ id: r.insertId });
});

router.put('/evoluciones/:id', async (req, res) => {
  const e = await evolucion(req, req.params.id);
  if (Number(e.profesional_id) !== Number(req.user.profesional_id)) throw forbidden('Solo quien la escribió puede corregirla');
  const datos = datosEvolucion(req.body);
  const r = await query('UPDATE hc_evoluciones SET ?, editado_en = NOW() WHERE id = ? AND DATE(creado_en) = CURDATE()', [datos, e.id]);
  if (!r.affectedRows) throw badRequest('Ya no se puede corregir: agregue una aclaración');
  res.json({ ok: true });
});

router.post('/evoluciones/:id/aclaraciones', async (req, res) => {
  required(req.body, ['texto']);
  const e = await evolucion(req, req.params.id);
  await query('INSERT INTO hc_aclaraciones SET ?', [
    { evolucion_id: e.id, profesional_id: req.user.profesional_id, usuario_id: req.user.id, texto: String(req.body.texto).trim() },
  ]);
  res.status(201).json({ ok: true });
});

module.exports = router;
