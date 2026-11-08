// Motor de disponibilidad: combina horario habitual, excepciones y turnos reservados.
const { query } = require('../db');
const { aMinutos, aHora, diaSemana } = require('../utils/fechas');
const { conflict, badRequest } = require('../utils/http');

const TIPOS_BLOQUEO = ['feriado', 'vacaciones', 'licencia', 'dia_libre', 'bloqueo'];

// Resta el intervalo [a, b) a una lista de franjas [[desde, hasta], ...] en minutos.
function restar(franjas, a, b) {
  const out = [];
  for (const [x, y] of franjas) {
    if (b <= x || a >= y) {
      out.push([x, y]);
      continue;
    }
    if (a > x) out.push([x, a]);
    if (b < y) out.push([b, y]);
  }
  return out;
}

// Carga horarios y excepciones de varios profesionales para un rango de fechas.
async function cargarContexto(orgId, profesionalIds, desde, hasta, conn) {
  if (!profesionalIds.length) return { horarios: [], excepciones: [] };
  const horarios = await query(
    `SELECT profesional_id, dia_semana, hora_desde, hora_hasta
       FROM horarios WHERE profesional_id IN (?) ORDER BY hora_desde`,
    [profesionalIds],
    conn
  );
  const excepciones = await query(
    `SELECT id, profesional_id, tipo, fecha_desde, fecha_hasta, hora_desde, hora_hasta, motivo
       FROM excepciones
      WHERE organizacion_id = ?
        AND (profesional_id IS NULL OR profesional_id IN (?))
        AND fecha_desde <= ? AND fecha_hasta >= ?`,
    [orgId, profesionalIds, hasta, desde],
    conn
  );
  return { horarios, excepciones };
}

// Franjas de atención efectivas de un profesional en una fecha, ya aplicadas las excepciones.
function franjasDelDia(ctx, profesionalId, fecha) {
  const pid = Number(profesionalId);
  const dow = diaSemana(fecha);
  const aplica = ctx.excepciones.filter(
    (e) =>
      (e.profesional_id === null || Number(e.profesional_id) === pid) &&
      e.fecha_desde <= fecha &&
      e.fecha_hasta >= fecha
  );

  let franjas;
  const especiales = aplica.filter((e) => e.tipo === 'horario_especial' && e.hora_desde && e.hora_hasta);
  if (especiales.length) {
    franjas = especiales.map((e) => [aMinutos(e.hora_desde), aMinutos(e.hora_hasta)]);
  } else {
    franjas = ctx.horarios
      .filter((h) => Number(h.profesional_id) === pid && Number(h.dia_semana) === dow)
      .map((h) => [aMinutos(h.hora_desde), aMinutos(h.hora_hasta)]);
  }

  const bloqueos = [];
  for (const e of aplica.filter((x) => TIPOS_BLOQUEO.includes(x.tipo))) {
    const a = e.hora_desde ? aMinutos(e.hora_desde) : 0;
    const b = e.hora_hasta ? aMinutos(e.hora_hasta) : 24 * 60;
    franjas = restar(franjas, a, b);
    bloqueos.push({ id: e.id, tipo: e.tipo, motivo: e.motivo, desde: aHora(a), hasta: aHora(Math.min(b, 1439)), dia_completo: !e.hora_desde });
  }

  franjas.sort((p, q) => p[0] - q[0]);
  return {
    franjas: franjas.map(([a, b]) => ({ desde: aHora(a), hasta: b >= 1440 ? '24:00' : aHora(b) })),
    minutos: franjas,
    bloqueos,
    horario_especial: especiales.length > 0,
  };
}

// Turnos activos (no cancelados) de un profesional que se superponen con [inicio, fin).
async function turnosSuperpuestos(profesionalId, inicio, fin, excluirId, conn) {
  return query(
    `SELECT t.id, t.inicio, t.fin, p.nombre, p.apellido
       FROM turnos t JOIN pacientes p ON p.id = t.paciente_id
      WHERE t.profesional_id = ? AND t.estado <> 'cancelado'
        AND t.inicio < ? AND t.fin > ? AND t.id <> ?`,
    [profesionalId, fin, inicio, excluirId || 0],
    conn
  );
}

// Calcula fin del turno y valida horario de atención, bloqueos y superposiciones.
// Si hay problemas y no se autorizó sobreturno, lanza 409 con code REQUIERE_SOBRETURNO.
async function validarTurno({ orgId, profesionalId, inicio, duracion, excluirId, sobreturno, permiteSobreturno }, conn) {
  const fecha = inicio.slice(0, 10);
  const a = aMinutos(inicio.slice(11, 16));
  const b = a + Number(duracion);
  if (!(duracion > 0)) throw badRequest('La duración debe ser mayor a cero');
  if (b > 1439) throw badRequest('El turno no puede terminar después de la medianoche');
  const fin = `${fecha} ${aHora(b)}:00`;

  const ctx = await cargarContexto(orgId, [profesionalId], fecha, fecha, conn);
  const dia = franjasDelDia(ctx, profesionalId, fecha);
  const dentro = dia.minutos.some(([x, y]) => a >= x && b <= y);
  const superpuestos = await turnosSuperpuestos(profesionalId, inicio, fin, excluirId, conn);

  const problemas = [];
  if (!dentro) {
    problemas.push(dia.bloqueos.length ? 'El horario está bloqueado o fuera de la atención del profesional' : 'El horario está fuera de la atención del profesional');
  }
  if (superpuestos.length) {
    const s = superpuestos[0];
    problemas.push(`Se superpone con el turno de ${s.apellido}, ${s.nombre} (${s.inicio.slice(11, 16)} a ${s.fin.slice(11, 16)})`);
  }

  if (problemas.length) {
    if (!sobreturno) throw conflict(problemas.join('. '), permiteSobreturno ? 'REQUIERE_SOBRETURNO' : 'NO_DISPONIBLE');
    if (!permiteSobreturno) throw conflict('No tiene permiso para asignar sobreturnos', 'NO_DISPONIBLE');
  }
  return { fin, esSobreturno: problemas.length > 0 };
}

// Horarios libres de un profesional en una fecha para una duración dada.
async function horariosLibres(orgId, profesional, fecha, duracion, excluirId) {
  const ctx = await cargarContexto(orgId, [profesional.id], fecha, fecha);
  const dia = franjasDelDia(ctx, profesional.id, fecha);
  const ocupados = (
    await query(
      `SELECT inicio, fin FROM turnos
        WHERE profesional_id = ? AND estado <> 'cancelado' AND inicio >= ? AND inicio < ? AND id <> ?`,
      [profesional.id, `${fecha} 00:00:00`, `${fecha} 23:59:59`, excluirId || 0]
    )
  ).map((t) => [aMinutos(t.inicio.slice(11, 16)), aMinutos(t.fin.slice(11, 16))]);

  const paso = Number(profesional.duracion_turno_min) || 30;
  const dur = Number(duracion) || paso;
  const libres = [];
  for (const [x, y] of dia.minutos) {
    for (let s = x; s + dur <= y; s += paso) {
      const e = s + dur;
      if (!ocupados.some(([oa, ob]) => s < ob && e > oa)) libres.push(aHora(s));
    }
  }
  return { franjas: dia.franjas, bloqueos: dia.bloqueos, libres };
}

module.exports = { cargarContexto, franjasDelDia, validarTurno, horariosLibres, turnosSuperpuestos };
