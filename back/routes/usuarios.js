const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { pick, required, bool, notFound, badRequest, conflict } = require('../utils/http');

// Todas las rutas de este módulo requieren rol admin (se aplica en index.js).
const router = Router();
const ROLES = ['admin', 'recepcion', 'profesional'];

router.get('/', async (req, res) => {
  res.json(
    await query(
      `SELECT u.id, u.nombre, u.email, u.rol, u.profesional_id, u.puede_sobreturno, u.activo, u.ultimo_acceso,
              p.nombre AS prof_nombre, p.apellido AS prof_apellido
         FROM usuarios u LEFT JOIN profesionales p ON p.id = u.profesional_id
        WHERE u.organizacion_id = ? ORDER BY u.nombre`,
      [req.orgId]
    )
  );
});

async function validar(req, datos, id) {
  if (datos.rol && !ROLES.includes(datos.rol)) throw badRequest('Rol inválido');
  if (datos.email) {
    datos.email = String(datos.email).trim().toLowerCase();
    const [dup] = await query('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [datos.email, id || 0]);
    if (dup) throw conflict('Ya existe un usuario con ese email');
  }
  if (datos.profesional_id) {
    const [p] = await query('SELECT id FROM profesionales WHERE id = ? AND organizacion_id = ?', [datos.profesional_id, req.orgId]);
    if (!p) throw badRequest('Profesional inválido');
  }
  if (datos.rol === 'profesional' && !datos.profesional_id) throw badRequest('El rol profesional requiere vincular un profesional');
}

router.post('/', async (req, res) => {
  required(req.body, ['nombre', 'email', 'password', 'rol']);
  if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
  const datos = pick(req.body, ['nombre', 'email', 'rol', 'profesional_id']);
  await validar(req, datos);
  const r = await query('INSERT INTO usuarios SET ?', [
    {
      ...datos,
      organizacion_id: req.orgId,
      puede_sobreturno: bool(req.body.puede_sobreturno),
      password_hash: await bcrypt.hash(String(req.body.password), 10),
    },
  ]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', async (req, res) => {
  const [u] = await query('SELECT * FROM usuarios WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!u) throw notFound('Usuario no encontrado');
  const datos = pick(req.body, ['nombre', 'email', 'rol', 'profesional_id']);
  if (req.body.puede_sobreturno !== undefined) datos.puede_sobreturno = bool(req.body.puede_sobreturno);
  if (req.body.activo !== undefined) datos.activo = bool(req.body.activo);
  await validar(req, { ...u, ...datos }, u.id);
  if (datos.email) datos.email = String(datos.email).trim().toLowerCase();
  if (u.id === req.user.id && (datos.activo === 0 || (datos.rol && datos.rol !== 'admin'))) {
    throw badRequest('No puede desactivarse ni quitarse el rol de administrador a sí mismo');
  }
  if (req.body.password) {
    if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
    datos.password_hash = await bcrypt.hash(String(req.body.password), 10);
  }
  if (Object.keys(datos).length) await query('UPDATE usuarios SET ? WHERE id = ?', [datos, u.id]);
  res.json({ ok: true });
});

module.exports = router;
