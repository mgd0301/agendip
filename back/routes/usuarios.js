const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../db');
const { pick, required, bool, notFound, badRequest, conflict } = require('../utils/http');
const { vincularCuenta, cuentaCompartida } = require('../services/usuarios');

// Todas las rutas de este módulo requieren rol admin (se aplica en index.js).
// Cada usuario es una cuenta global con un acceso (membresía) a esta organización.
const router = Router();
const ROLES = ['admin', 'recepcion', 'profesional'];

router.get('/', async (req, res) => {
  res.json(
    await query(
      `SELECT u.id, u.nombre, u.email, m.rol, m.profesional_id, m.puede_sobreturno, m.activo, u.ultimo_acceso,
              p.nombre AS prof_nombre, p.apellido AS prof_apellido,
              (u.es_superadmin = 1 OR EXISTS (SELECT 1 FROM membresias m2
                 WHERE m2.usuario_id = u.id AND m2.organizacion_id <> m.organizacion_id)) AS compartida
         FROM membresias m
         JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN profesionales p ON p.id = m.profesional_id
        WHERE m.organizacion_id = ? ORDER BY u.nombre`,
      [req.orgId]
    )
  );
});

async function validar(req, datos) {
  if (datos.rol && !ROLES.includes(datos.rol)) throw badRequest('Rol inválido');
  if (datos.profesional_id) {
    const [p] = await query('SELECT id FROM profesionales WHERE id = ? AND organizacion_id = ?', [datos.profesional_id, req.orgId]);
    if (!p) throw badRequest('Profesional inválido');
  }
  if (datos.rol === 'profesional' && !datos.profesional_id) throw badRequest('El rol profesional requiere vincular un profesional');
}

// Si el email ya tiene cuenta (por ejemplo, trabaja en otro consultorio) se le da acceso
// a este con su contraseña de siempre; si no, se crea la cuenta con la contraseña indicada.
router.post('/', async (req, res) => {
  required(req.body, ['nombre', 'email', 'rol']);
  const acceso = pick(req.body, ['rol', 'profesional_id']);
  acceso.puede_sobreturno = bool(req.body.puede_sobreturno);
  await validar(req, acceso);
  const r = await transaction((conn) => vincularCuenta(conn, req.orgId, req.body, acceso));
  res.status(201).json(r);
});

router.put('/:id', async (req, res) => {
  const [u] = await query(
    `SELECT u.id, u.nombre, u.email, m.id AS membresia_id, m.rol, m.profesional_id
       FROM membresias m JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.usuario_id = ? AND m.organizacion_id = ?`,
    [req.params.id, req.orgId]
  );
  if (!u) throw notFound('Usuario no encontrado');

  const acceso = pick(req.body, ['rol', 'profesional_id']);
  if (req.body.puede_sobreturno !== undefined) acceso.puede_sobreturno = bool(req.body.puede_sobreturno);
  if (req.body.activo !== undefined) acceso.activo = bool(req.body.activo);
  await validar(req, { ...u, ...acceso });
  if (u.id === req.user.id && (acceso.activo === 0 || (acceso.rol && acceso.rol !== 'admin'))) {
    throw badRequest('No puede desactivarse ni quitarse el rol de administrador a sí mismo');
  }

  const cuenta = pick(req.body, ['nombre', 'email']);
  if (cuenta.email) cuenta.email = String(cuenta.email).trim().toLowerCase();
  for (const k of Object.keys(cuenta)) if (cuenta[k] === u[k]) delete cuenta[k];
  if (req.body.password) {
    if (String(req.body.password).length < 6) throw badRequest('La contraseña debe tener al menos 6 caracteres');
    cuenta.password_hash = await bcrypt.hash(String(req.body.password), 10);
  }
  if (Object.keys(cuenta).length) {
    if (await cuentaCompartida(u.id, req.orgId)) {
      throw badRequest('Este usuario también trabaja en otro consultorio: su nombre, email y contraseña no se pueden cambiar desde acá');
    }
    if (cuenta.nombre === null || cuenta.email === null) throw badRequest('El nombre y el email son obligatorios');
    if (cuenta.email) {
      const [dup] = await query('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [cuenta.email, u.id]);
      if (dup) throw conflict('Ya existe un usuario con ese email');
    }
    await query('UPDATE usuarios SET ? WHERE id = ?', [cuenta, u.id]);
  }
  if (Object.keys(acceso).length) await query('UPDATE membresias SET ? WHERE id = ?', [acceso, u.membresia_id]);
  res.json({ ok: true });
});

module.exports = router;
