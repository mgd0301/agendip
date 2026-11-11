const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { badRequest, conflict } = require('../utils/http');

// Da acceso a una organización a la cuenta con ese email. Si la cuenta no existe se crea
// (y entonces la contraseña es obligatoria); si existe, conserva su nombre y contraseña.
// Si ya tenía un acceso dado de baja en la organización, se reactiva con los datos nuevos.
async function vincularCuenta(conn, orgId, { nombre, email, password }, acceso) {
  email = String(email).trim().toLowerCase();
  const [[cuenta]] = await conn.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  let userId = cuenta?.id;
  if (!userId) {
    if (!password) throw badRequest('Ingrese una contraseña para la cuenta nueva', 'REQUIERE_PASSWORD');
    if (String(password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
    const [r] = await conn.query('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)', [
      nombre,
      email,
      await bcrypt.hash(String(password), 10),
    ]);
    userId = r.insertId;
  } else {
    const [[m]] = await conn.query('SELECT activo FROM membresias WHERE usuario_id = ? AND organizacion_id = ?', [userId, orgId]);
    if (m?.activo) throw conflict('Ese usuario ya tiene acceso a este consultorio');
  }
  await conn.query(
    `INSERT INTO membresias (usuario_id, organizacion_id, rol, profesional_id, puede_sobreturno, activo)
     VALUES (?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE rol = VALUES(rol), profesional_id = VALUES(profesional_id),
       puede_sobreturno = VALUES(puede_sobreturno), activo = 1`,
    [userId, orgId, acceso.rol, acceso.profesional_id || null, acceso.puede_sobreturno ? 1 : 0]
  );
  return { id: userId, existente: !!cuenta };
}

// Una cuenta que además trabaja en otra organización (o es superadmin) es de la persona:
// el admin de un consultorio no puede cambiarle el nombre, el email ni la contraseña,
// porque eso le daría acceso a los otros consultorios de esa persona.
async function cuentaCompartida(userId, orgId) {
  const [r] = await query(
    `SELECT u.es_superadmin,
            (SELECT COUNT(*) FROM membresias m WHERE m.usuario_id = u.id AND m.organizacion_id <> ?) AS otras
       FROM usuarios u WHERE u.id = ?`,
    [orgId, userId]
  );
  return !!(r && (Number(r.es_superadmin) === 1 || Number(r.otras) > 0));
}

module.exports = { vincularCuenta, cuentaCompartida };
