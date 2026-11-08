const { query } = require('../db');
const { DIAS, diaSemana, formatoFecha } = require('../utils/fechas');
const { notFound } = require('../utils/http');

async function datosTurno(orgId, turnoId) {
  const [t] = await query(
    `SELECT t.*, pa.nombre AS pac_nombre, pa.apellido AS pac_apellido, pa.telefono AS pac_telefono,
            pa.email AS pac_email, pr.nombre AS prof_nombre, pr.apellido AS prof_apellido,
            ps.nombre AS prest_nombre, o.nombre AS org_nombre, o.direccion AS org_direccion,
            o.telefono AS org_telefono, o.whatsapp_codigo_pais
       FROM turnos t
       JOIN pacientes pa ON pa.id = t.paciente_id
       JOIN profesionales pr ON pr.id = t.profesional_id
       JOIN organizaciones o ON o.id = t.organizacion_id
       LEFT JOIN prestaciones ps ON ps.id = t.prestacion_id
      WHERE t.id = ? AND t.organizacion_id = ?`,
    [turnoId, orgId]
  );
  if (!t) throw notFound('Turno no encontrado');
  return t;
}

function variables(t) {
  const fecha = t.inicio.slice(0, 10);
  return {
    paciente: `${t.pac_nombre} ${t.pac_apellido}`,
    paciente_nombre: t.pac_nombre,
    profesional: `${t.prof_nombre} ${t.prof_apellido}`,
    prestacion: t.prest_nombre || 'Consulta',
    fecha: formatoFecha(fecha),
    dia: DIAS[diaSemana(fecha)],
    hora: t.inicio.slice(11, 16),
    organizacion: t.org_nombre || '',
    direccion: t.org_direccion || '',
    telefono: t.org_telefono || '',
  };
}

const render = (texto, vars) => (texto || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// Normaliza un teléfono para wa.me: solo dígitos y con prefijo de país.
function telefonoWhatsapp(telefono, codigoPais = '549') {
  let d = String(telefono || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith(codigoPais)) return d;
  d = d.replace(/^0/, '');
  // Argentina: celulares cargados como "característica + 15 + número" (12 dígitos): se quita el 15.
  if (codigoPais === '549' && d.length === 12) {
    const i = [2, 3, 4].find((pos) => d.slice(pos, pos + 2) === '15');
    if (i !== undefined) d = d.slice(0, i) + d.slice(i + 2);
  }
  if (d.length <= 11) d = codigoPais + d;
  return d;
}

async function generarMensaje(orgId, turnoId, tipo, canal) {
  const t = await datosTurno(orgId, turnoId);
  const [plantilla] = await query(
    'SELECT asunto, cuerpo FROM plantillas_mensaje WHERE organizacion_id = ? AND tipo = ? AND canal = ? AND activo = 1',
    [orgId, tipo, canal]
  );
  const vars = variables(t);
  const texto = render(plantilla ? plantilla.cuerpo : 'Turno con {profesional} el {dia} {fecha} a las {hora} hs.', vars);
  const asunto = plantilla ? render(plantilla.asunto, vars) : null;

  let link = null;
  let destinatario = canal === 'email' ? t.pac_email : t.pac_telefono;
  if (canal === 'whatsapp') {
    const tel = telefonoWhatsapp(t.pac_telefono, t.whatsapp_codigo_pais);
    destinatario = tel;
    if (tel) link = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
  }
  return { turno: t, texto, asunto, link, destinatario };
}

module.exports = { generarMensaje, render, telefonoWhatsapp };
