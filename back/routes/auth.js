const { Router } = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../db');
const { authCuenta, membresia } = require('../middleware/auth');
const { HttpError, required, badRequest, conflict } = require('../utils/http');
const { ahora } = require('../utils/fechas');
const { crearDefaults } = require('../services/organizacion');
const { enviarMail } = require('../services/mail');

const router = Router();

// v = versión de sesión de la cuenta: al cambiar la contraseña sube y los tokens viejos dejan de valer.
const firmar = (cuenta, orgId) =>
  jwt.sign({ id: cuenta.id, org: orgId || null, v: Number(cuenta.sesion_version) || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '12h',
  });

// Organizaciones activas en las que la cuenta tiene acceso.
const organizacionesDe = (userId) =>
  query(
    `SELECT o.id, o.nombre, m.rol
       FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id
      WHERE m.usuario_id = ? AND m.activo = 1 AND o.activo = 1
      ORDER BY o.nombre`,
    [userId]
  );

// Datos de la sesión: la cuenta, sus organizaciones y su rol en la organización actual.
async function perfil(cuenta, orgId) {
  const organizaciones = await organizacionesDe(cuenta.id);
  const m = await membresia(cuenta, orgId);
  let organizacion = null;
  if (m) {
    const [o] = await query('SELECT id, nombre, plan, activo FROM organizaciones WHERE id = ?', [orgId]);
    organizacion = { id: o.id, nombre: o.nombre, plan: o.plan, activo: !!o.activo };
  }
  return {
    id: cuenta.id,
    nombre: cuenta.nombre,
    email: cuenta.email,
    es_superadmin: !!cuenta.es_superadmin,
    rol: m?.rol || null,
    profesional_id: m?.profesional_id || null,
    puede_sobreturno: m ? m.rol === 'admin' || !!m.puede_sobreturno : false,
    organizacion,
    organizaciones,
  };
}

async function sesion(cuenta, orgId) {
  if (orgId) await query('UPDATE usuarios SET ultima_organizacion_id = ? WHERE id = ?', [orgId, cuenta.id]);
  return { token: firmar(cuenta, orgId), usuario: await perfil(cuenta, orgId) };
}

// Si la cuenta trabaja en varias organizaciones y no indica en cuál entrar, se devuelve
// la lista para que elija (organizacion_id = 0 deja al superadmin solo en su panel).
router.post('/login', async (req, res) => {
  required(req.body, ['email', 'password']);
  const [user] = await query('SELECT * FROM usuarios WHERE email = ? AND activo = 1', [
    String(req.body.email).trim().toLowerCase(),
  ]);
  if (!user || !(await bcrypt.compare(String(req.body.password), user.password_hash))) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }
  const cuenta = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    es_superadmin: Number(user.es_superadmin) === 1,
    sesion_version: user.sesion_version,
  };
  const orgs = await organizacionesDe(user.id);
  if (!orgs.length && !cuenta.es_superadmin) throw new HttpError(401, 'Su usuario no tiene acceso a ningún consultorio activo');

  let orgId;
  const pedida = req.body.organizacion_id;
  if (pedida !== undefined && pedida !== null && pedida !== '') {
    orgId = Number(pedida) || null;
    if (orgId && !(await membresia(cuenta, orgId))) throw badRequest('No tiene acceso a ese consultorio');
    if (!orgId && !cuenta.es_superadmin) throw badRequest('Elija un consultorio');
  } else if (orgs.length === 1 && !cuenta.es_superadmin) {
    orgId = orgs[0].id;
  } else if (orgs.length === 0) {
    orgId = null;
  } else {
    return res.json({ elegir: true, organizaciones: orgs, ultima: user.ultima_organizacion_id, es_superadmin: cuenta.es_superadmin });
  }

  await query('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?', [ahora(), user.id]);
  res.json(await sesion(cuenta, orgId));
});

router.post('/cambiar-organizacion', authCuenta, async (req, res) => {
  const orgId = Number(req.body.organizacion_id) || null;
  if (orgId && !(await membresia(req.cuenta, orgId))) throw badRequest('No tiene acceso a ese consultorio');
  if (!orgId && !req.cuenta.es_superadmin) throw badRequest('Elija un consultorio');
  res.json(await sesion(req.cuenta, orgId));
});

// Alta de una organización nueva con su usuario administrador.
router.post('/registro', async (req, res) => {
  required(req.body, ['organizacion', 'nombre', 'email', 'password']);
  if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
  const email = String(req.body.email).trim().toLowerCase();
  const [existe] = await query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe) throw badRequest('Ya existe un usuario con ese email');

  const hash = await bcrypt.hash(String(req.body.password), 10);
  const { userId, orgId } = await transaction(async (conn) => {
    const [org] = await conn.query('INSERT INTO organizaciones (nombre, tipo) VALUES (?, ?)', [
      req.body.organizacion,
      req.body.tipo || 'consultorio',
    ]);
    await crearDefaults(conn, org.insertId);
    const [u] = await conn.query('INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)', [
      req.body.nombre,
      email,
      hash,
    ]);
    await conn.query(
      "INSERT INTO membresias (usuario_id, organizacion_id, rol, puede_sobreturno) VALUES (?, ?, 'admin', 1)",
      [u.insertId, org.insertId]
    );
    return { userId: u.insertId, orgId: org.insertId };
  });
  const cuenta = { id: userId, nombre: req.body.nombre, email, es_superadmin: false, sesion_version: 0 };
  res.status(201).json(await sesion(cuenta, orgId));
});

router.get('/me', authCuenta, async (req, res) => {
  const usuario = await perfil(req.cuenta, req.tokenOrg);
  // La organización del token dejó de estar disponible (baja del acceso o del consultorio).
  if (req.tokenOrg && !usuario.organizacion) throw new HttpError(401, 'Ya no tiene acceso a este consultorio');
  res.json(usuario);
});

const validarPassword = (p) => {
  if (String(p || '').length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
};

async function verificarPassword(userId, password) {
  const [u] = await query('SELECT password_hash FROM usuarios WHERE id = ?', [userId]);
  if (!password || !(await bcrypt.compare(String(password), u.password_hash))) {
    throw badRequest('La contraseña actual no es correcta');
  }
}

// Cambia la contraseña y cierra todas las sesiones abiertas de la cuenta.
async function cambiarPassword(userId, nueva) {
  await query('UPDATE usuarios SET password_hash = ?, sesion_version = sesion_version + 1 WHERE id = ?', [
    await bcrypt.hash(String(nueva), 10),
    userId,
  ]);
  const [u] = await query('SELECT id, sesion_version FROM usuarios WHERE id = ?', [userId]);
  return u;
}

// Mi cuenta: nombre y email. Cambiar el email (que es el usuario de ingreso) pide la contraseña.
router.put('/perfil', authCuenta, async (req, res) => {
  required(req.body, ['nombre', 'email']);
  const email = String(req.body.email).trim().toLowerCase();
  if (email !== req.cuenta.email) {
    await verificarPassword(req.cuenta.id, req.body.password_actual);
    const [dup] = await query('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email, req.cuenta.id]);
    if (dup) throw conflict('Ya existe una cuenta con ese email');
  }
  await query('UPDATE usuarios SET nombre = ?, email = ? WHERE id = ?', [String(req.body.nombre).trim(), email, req.cuenta.id]);
  res.json(await perfil({ ...req.cuenta, nombre: String(req.body.nombre).trim(), email }, req.tokenOrg));
});

// Devuelve un token nuevo para esta sesión; las demás (otros dispositivos) quedan cerradas.
router.put('/password', authCuenta, async (req, res) => {
  required(req.body, ['actual', 'nueva']);
  validarPassword(req.body.nueva);
  await verificarPassword(req.cuenta.id, req.body.actual);
  const u = await cambiarPassword(req.cuenta.id, req.body.nueva);
  res.json({ token: firmar(u, req.tokenOrg) });
});

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const MINUTOS_RECUPERACION = 60;

// Olvidé mi contraseña: envía por email un link para elegir una nueva.
// Responde lo mismo exista o no la cuenta, para no revelar qué emails están registrados.
router.post('/recuperar', async (req, res) => {
  required(req.body, ['email']);
  const [u] = await query('SELECT id, nombre, email FROM usuarios WHERE email = ? AND activo = 1', [
    String(req.body.email).trim().toLowerCase(),
  ]);
  if (u) {
    const token = crypto.randomBytes(32).toString('hex');
    const expira = ahora(new Date(Date.now() + MINUTOS_RECUPERACION * 60000));
    // Un pedido nuevo anula los anteriores que no se usaron.
    await query('UPDATE recuperaciones_password SET usado_en = ? WHERE usuario_id = ? AND usado_en IS NULL', [ahora(), u.id]);
    await query('INSERT INTO recuperaciones_password (usuario_id, token_hash, expira) VALUES (?, ?, ?)', [u.id, hashToken(token), expira]);
    const base = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    try {
      await enviarMail({
        para: u.email,
        asunto: 'Recuperar tu contraseña de Agendip',
        texto:
          `Hola ${u.nombre}:\n\n` +
          `Para elegir una contraseña nueva entrá a este link (vale por ${MINUTOS_RECUPERACION} minutos):\n\n` +
          `${base}/restablecer?token=${token}\n\n` +
          'Si no lo pediste, ignorá este email: tu contraseña no cambia.\n\nAgendip',
      });
    } catch (err) {
      console.error('No se pudo enviar el email de recuperación:', err.message);
      throw new HttpError(502, 'No se pudo enviar el email. Intente de nuevo en unos minutos.');
    }
  }
  res.json({ ok: true });
});

router.post('/restablecer', async (req, res) => {
  required(req.body, ['token', 'password']);
  validarPassword(req.body.password);
  const [r] = await query(
    'SELECT id, usuario_id FROM recuperaciones_password WHERE token_hash = ? AND usado_en IS NULL AND expira > ?',
    [hashToken(req.body.token), ahora()]
  );
  if (!r) throw badRequest('El link no es válido o ya venció. Pida uno nuevo.');
  await query('UPDATE recuperaciones_password SET usado_en = ? WHERE id = ?', [ahora(), r.id]);
  await cambiarPassword(r.usuario_id, req.body.password);
  res.json({ ok: true });
});

module.exports = router;
