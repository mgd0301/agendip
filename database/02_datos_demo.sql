-- =====================================================================
--  AGENDIP - Datos iniciales de demostración
--  Ejecutar después de 01_estructura.sql. Compatible con MySQL 5.0.
--
--  Usuario de acceso:  admin@agendip.com  /  admin123
--  (cambiar la contraseña después del primer ingreso)
-- =====================================================================

USE agendia;
SET NAMES utf8;

INSERT IGNORE INTO organizaciones (id, nombre, tipo, email, telefono, direccion)
VALUES (1, 'Consultorio Demo', 'consultorio', 'contacto@agendip.com', '351 555-0000', 'Av. Siempre Viva 742');

INSERT IGNORE INTO profesionales (id, organizacion_id, nombre, apellido, especialidad, matricula, color, duracion_turno_min)
VALUES
  (1, 1, 'Laura', 'Gómez', 'Clínica médica', 'MP 12345', '#2563eb', 30),
  (2, 1, 'Martín', 'Pérez', 'Kinesiología', 'MP 67890', '#059669', 30);

INSERT IGNORE INTO usuarios (id, nombre, email, password_hash)
VALUES (1, 'Administrador', 'admin@agendip.com',
        '$2b$10$91eXZ.h3CdDbtKBdUH.a2O85WHWeObhbarME1zFoBxLu.jlqxIEyu');

INSERT IGNORE INTO membresias (usuario_id, organizacion_id, rol, puede_sobreturno)
VALUES (1, 1, 'admin', 1);

INSERT IGNORE INTO prestaciones (id, organizacion_id, nombre, duracion_min, color)
VALUES
  (1, 1, 'Consulta', 30, '#2563eb'),
  (2, 1, 'Primera consulta', 60, '#7c3aed'),
  (3, 1, 'Control', 15, '#0891b2'),
  (4, 1, 'Sesión de kinesiología', 45, '#059669');

-- Horario habitual de ejemplo (documento funcional, sección 5)
-- 0=dom 1=lun 2=mar 3=mié 4=jue 5=vie 6=sáb
DELETE FROM horarios WHERE profesional_id IN (1, 2);
INSERT INTO horarios (profesional_id, dia_semana, hora_desde, hora_hasta) VALUES
  (1, 1, '08:00:00', '12:00:00'),
  (1, 2, '14:00:00', '20:00:00'),
  (1, 4, '08:00:00', '12:00:00'),
  (1, 4, '16:00:00', '20:00:00'),
  (1, 5, '08:00:00', '12:00:00'),
  (2, 1, '14:00:00', '19:00:00'),
  (2, 3, '09:00:00', '13:00:00'),
  (2, 5, '14:00:00', '19:00:00');

INSERT IGNORE INTO pacientes (id, organizacion_id, nombre, apellido, dni, telefono, email)
VALUES
  (1, 1, 'Ana', 'Fernández', '30111222', '351 6111111', 'ana@example.com'),
  (2, 1, 'Carlos', 'López', '28333444', '351 6222222', NULL),
  (3, 1, 'Sofía', 'Martínez', '35555666', '351 6333333', NULL);

INSERT IGNORE INTO estados_config (organizacion_id, estado, etiqueta, color) VALUES
  (1, 'pendiente',  'Pendiente',  '#f59e0b'),
  (1, 'confirmado', 'Confirmado', '#2563eb'),
  (1, 'atendido',   'Atendido',   '#16a34a'),
  (1, 'ausente',    'Ausente',    '#dc2626'),
  (1, 'cancelado',  'Cancelado',  '#94a3b8');

INSERT IGNORE INTO plantillas_mensaje (organizacion_id, tipo, canal, asunto, cuerpo) VALUES
  (1, 'confirmacion', 'whatsapp', NULL,
   'Hola {paciente_nombre}! Te recordamos tu turno con {profesional} el {dia} {fecha} a las {hora} hs. {organizacion} - {direccion}. Si no podes asistir, por favor avisanos.'),
  (1, 'recordatorio', 'whatsapp', NULL,
   'Hola {paciente_nombre}! Te recordamos que manana tenes turno con {profesional} a las {hora} hs. {organizacion}.'),
  (1, 'cancelacion', 'whatsapp', NULL,
   'Hola {paciente_nombre}. Tu turno con {profesional} del {dia} {fecha} a las {hora} hs fue cancelado. Comunicate con nosotros para reprogramarlo. {organizacion}'),
  (1, 'reprogramacion', 'whatsapp', NULL,
   'Hola {paciente_nombre}. Tu turno con {profesional} fue reprogramado para el {dia} {fecha} a las {hora} hs. {organizacion}'),
  (1, 'confirmacion', 'email', 'Confirmación de turno - {organizacion}',
   'Hola {paciente}:\n\nTe confirmamos tu turno con {profesional} el {dia} {fecha} a las {hora} hs.\nPrestación: {prestacion}\nDirección: {direccion}\n\nSaludos,\n{organizacion}'),
  (1, 'recordatorio', 'email', 'Recordatorio de turno - {organizacion}',
   'Hola {paciente}:\n\nTe recordamos tu turno con {profesional} el {dia} {fecha} a las {hora} hs.\n\nSaludos,\n{organizacion}'),
  (1, 'cancelacion', 'email', 'Turno cancelado - {organizacion}',
   'Hola {paciente}:\n\nTu turno con {profesional} del {dia} {fecha} a las {hora} hs fue cancelado.\n\nSaludos,\n{organizacion}'),
  (1, 'reprogramacion', 'email', 'Turno reprogramado - {organizacion}',
   'Hola {paciente}:\n\nTu turno con {profesional} fue reprogramado para el {dia} {fecha} a las {hora} hs.\n\nSaludos,\n{organizacion}');
