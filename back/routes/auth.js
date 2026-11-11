const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../db');
const { authCuenta, membresia } = require('../middleware/auth');
const { HttpError, required, badRequest } = require('../utils/http');
const { ahora } = require('../utils/fechas');
const { crearDefaults } = require('../services/organizacion');

const router = Router();

const firmar = (userId, orgId) =>
  jwt.sign({ id: userId, org: orgId || null }, process.env.JWT_SECRET, {
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
  return { token: firmar(cuenta.id, orgId), usuario: await perfil(cuenta, orgId) };
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
  const cuenta = { id: user.id, nombre: user.nombre, email: user.email, es_superadmin: Number(user.es_superadmin) === 1 };
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
  const cuenta = { id: userId, nombre: req.body.nombre, email, es_superadmin: false };
  res.status(201).json(await sesion(cuenta, orgId));
});

router.get('/me', authCuenta, async (req, res) => {
  const usuario = await perfil(req.cuenta, req.tokenOrg);
  // La organización del token dejó de estar disponible (baja del acceso o del consultorio).
  if (req.tokenOrg && !usuario.organizacion) throw new HttpError(401, 'Ya no tiene acceso a este consultorio');
  res.json(usuario);
});

router.put('/password', authCuenta, async (req, res) => {
  required(req.body, ['actual', 'nueva']);
  if (String(req.body.nueva).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
  const [u] = await query('SELECT password_hash FROM usuarios WHERE id = ?', [req.cuenta.id]);
  if (!(await bcrypt.compare(String(req.body.actual), u.password_hash))) throw badRequest('La contraseña actual no es correcta');
  await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(req.body.nueva), 10), req.cuenta.id]);
  res.json({ ok: true });
});

module.exports = router;
