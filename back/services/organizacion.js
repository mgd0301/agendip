// Datos por defecto que se crean al registrar una organización nueva.
const ESTADOS = [
  ['pendiente', 'Pendiente', '#f59e0b'],
  ['confirmado', 'Confirmado', '#2563eb'],
  ['atendido', 'Atendido', '#16a34a'],
  ['ausente', 'Ausente', '#dc2626'],
  ['cancelado', 'Cancelado', '#94a3b8'],
];

const PLANTILLAS = [
  ['confirmacion', 'whatsapp', null,
    'Hola {paciente_nombre}! Te recordamos tu turno con {profesional} el {dia} {fecha} a las {hora} hs. {organizacion} - {direccion}. Si no podés asistir, por favor avisanos.'],
  ['recordatorio', 'whatsapp', null,
    'Hola {paciente_nombre}! Te recordamos que mañana tenés turno con {profesional} a las {hora} hs. {organizacion}.'],
  ['cancelacion', 'whatsapp', null,
    'Hola {paciente_nombre}. Tu turno con {profesional} del {dia} {fecha} a las {hora} hs fue cancelado. Comunicate con nosotros para reprogramarlo. {organizacion}'],
  ['reprogramacion', 'whatsapp', null,
    'Hola {paciente_nombre}. Tu turno con {profesional} fue reprogramado para el {dia} {fecha} a las {hora} hs. {organizacion}'],
  ['confirmacion', 'email', 'Confirmación de turno - {organizacion}',
    'Hola {paciente}:\n\nTe confirmamos tu turno con {profesional} el {dia} {fecha} a las {hora} hs.\nPrestación: {prestacion}\nDirección: {direccion}\n\nSaludos,\n{organizacion}'],
  ['recordatorio', 'email', 'Recordatorio de turno - {organizacion}',
    'Hola {paciente}:\n\nTe recordamos tu turno con {profesional} el {dia} {fecha} a las {hora} hs.\n\nSaludos,\n{organizacion}'],
  ['cancelacion', 'email', 'Turno cancelado - {organizacion}',
    'Hola {paciente}:\n\nTu turno con {profesional} del {dia} {fecha} a las {hora} hs fue cancelado.\n\nSaludos,\n{organizacion}'],
  ['reprogramacion', 'email', 'Turno reprogramado - {organizacion}',
    'Hola {paciente}:\n\nTu turno con {profesional} fue reprogramado para el {dia} {fecha} a las {hora} hs.\n\nSaludos,\n{organizacion}'],
];

async function crearDefaults(conn, orgId) {
  await conn.query(
    'INSERT IGNORE INTO estados_config (organizacion_id, estado, etiqueta, color) VALUES ?',
    [ESTADOS.map((e) => [orgId, ...e])]
  );
  await conn.query(
    'INSERT IGNORE INTO plantillas_mensaje (organizacion_id, tipo, canal, asunto, cuerpo) VALUES ?',
    [PLANTILLAS.map((p) => [orgId, ...p])]
  );
}

module.exports = { crearDefaults };
