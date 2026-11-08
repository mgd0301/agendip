const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../db');
const { auth } = require('../middleware/auth');
const { HttpError, required, badRequest } = require('../utils/http');
const { ahora } = require('../utils/fechas');
const { crearDefaults } = require('../services/organizacion');

const router = Router();

const firmar = (user) =>
  jwt.sign({ id: user.id, org: user.organizacion_id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '12h',
  });

async function perfil(userId) {
  const [u] = await query(
    `SELECT u.id, u.nombre, u.email, u.rol, u.profesional_id, u.puede_sobreturno, u.organizacion_id,
            o.nombre AS organizacion_nombre, o.plan
       FROM usuarios u JOIN organizaciones o ON o.id = u.organizacion_id
      WHERE u.id = ?`,
    [userId]
  );
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    profesional_id: u.profesional_id,
    puede_sobreturno: u.rol === 'admin' || !!u.puede_sobreturno,
    organizacion: { id: u.organizacion_id, nombre: u.organizacion_nombre, plan: u.plan },
  };
}

router.post('/login', async (req, res) => {
  required(req.body, ['email', 'password']);
  const [user] = await query(
    `SELECT u.* FROM usuarios u JOIN organizaciones o ON o.id = u.organizacion_id
      WHERE u.email = ? AND u.activo = 1 AND o.activo = 1`,
    [String(req.body.email).trim().toLowerCase()]
  );
  if (!user || !(await bcrypt.compare(String(req.body.password), user.password_hash))) {
    throw new HttpError(401, 'Email o contraseña incorrectos');
  }
  await query('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?', [ahora(), user.id]);
  res.json({ token: firmar(user), usuario: await perfil(user.id) });
});

// Alta de una organización nueva con su usuario administrador.
router.post('/registro', async (req, res) => {
  required(req.body, ['organizacion', 'nombre', 'email', 'password']);
  if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
  const email = String(req.body.email).trim().toLowerCase();
  const [existe] = await query('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe) throw badRequest('Ya existe un usuario con ese email');

  const hash = await bcrypt.hash(String(req.body.password), 10);
  const userId = await transaction(async (conn) => {
    const [org] = await conn.query('INSERT INTO organizaciones (nombre, tipo) VALUES (?, ?)', [
      req.body.organizacion,
      req.body.tipo || 'consultorio',
    ]);
    await crearDefaults(conn, org.insertId);
    const [u] = await conn.query(
      `INSERT INTO usuarios (organizacion_id, nombre, email, password_hash, rol, puede_sobreturno)
       VALUES (?, ?, ?, ?, 'admin', 1)`,
      [org.insertId, req.body.nombre, email, hash]
    );
    return u.insertId;
  });
  const usuario = await perfil(userId);
  res.status(201).json({ token: firmar({ id: userId, organizacion_id: usuario.organizacion.id }), usuario });
});

router.get('/me', auth, async (req, res) => {
  res.json(await perfil(req.user.id));
});

router.put('/password', auth, async (req, res) => {
  required(req.body, ['actual', 'nueva']);
  if (String(req.body.nueva).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
  const [u] = await query('SELECT password_hash FROM usuarios WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(String(req.body.actual), u.password_hash))) throw badRequest('La contraseña actual no es correcta');
  await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(req.body.nueva), 10), req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
